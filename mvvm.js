var mvvm = new function() {
    var record      = null;     // Variable to record into



    // Master observable property
    this.obs = function(initial, tag) {
        var fnc = null;

        if (initial != null) {
            // If it's an object; look at it's type
            if (obsfnc.hasOwnProperty(Object.prototype.toString.call(initial)))
                fnc = obsfnc[Object.prototype.toString.call(initial)];
            else
                console.log('Unsupported observable type: ' + typeof initial);

        } else
            console.log("We currently don't support dynamic binding");

        var val = fnc.apply(this, arguments);

        if (tag != null)
            val.tag = tag;

        return val;
    }



    // This function extend the functions of the baseclass only
    function extend(baseClass) {
        var props = Object.getOwnPropertyNames(baseClass);

        baseClass.base = {};

        for (var i = 0; i < props.length; i++) {
            if (typeof baseClass[props[i]] == "function")
                baseClass.base[props[i]] = baseClass[props[i]];
        }

        return baseClass;
    }



    // Observable property
    this.obsProperty = (function(initial) {
        value.domDeps = [];     // DOM elements that depend on this value
        value.fncDeps = [];     // Computed functions that depend on this value

        // Function to return the value
        function value() {
            // An argument means that we are setting it
            if (arguments.length != 0) {
                value.set(arguments[0]);
                value.update();
            }

            // In recording mode, record the dependencies (2ways)
            if (record != null) {
                value.fncDeps.push(record);
                record.addDep(value);
            }

            return value.value;
        }

        // Function to update the dependents
        value.update = function() {
            // Scan the list of DOM dependencies and update the elements
            for (var i = 0; i < value.domDeps.length; i++)
                value.domDeps[i].element[value.domDeps[i].key] = value.value;

            // Scan the list of functions and update them
            for (var i = 0; i < value.fncDeps.length; i++)
                value.fncDeps[i].update();
        }

        // Adds a dependency for a DOM element
        value.addDep = function(dep, key) {
            // We're adding a DOM dependency
            value.domDeps.push({   "element": dep, "key": key   });

            // Initialize the value
            dep[key] = value.value;
        }

        // Remove a dependency for a function
        value.remDep = function(dep) {
            value.fncDeps.splice(value.fncDeps.indexOf(dep), 1);
        }

        // Function to set the value
        value.set = function(val) {
            value.value = val;
        };

        value.set(initial);

        return value;
    })



    // Observable function
    this.obsFunction = (function(initial) {
        var value = extend(this.obsProperty(initial));

        value.deps    = [];     // Dependencies of this function
        value.fnc     = null;   // Function generator

        // Function to update the dependents
        value.update = function() {
            if (value.fnc != null)
                value.set(value.fnc);

            value.base.update();
        }

        // Adds a dependency for a DOM element
        value.addDep = function(dep, key) {
            // One single argument means that we're adding a function
            if (arguments.length == 1)
                value.deps.push(dep);

            // Two arguments means that we're adding a DOM dependency
            else
                value.base.addDep(dep, key);
        }

        // Function to set the value
        value.set = function(val) {
            // First remove all previous dependencies
            for (var i = 0; i < value.deps.length; i++)
                value.deps[i].remDep(value);
            value.deps = [];

            // Find the dependencies
            var oldrec  = record;
            record      = value;
            value.fnc   = val;
            value.base.set(arguments[0]());
            record      = oldrec;
        };

        value.set(initial);

        return value;
    })



    // Observable array
    this.obsArray = function(initial) {
        value.anchors   = [];   // List of DOM anchor points for the template
        value.templates = [];   // List of templates
        value.parents   = [];   // List of parent models

        // Function to return the value
        function value() {
            return value.value;
        }

        value.setTemplate = function(node, model) {
            var template = [];

            // First; extract the template as a reference
            while (node.childElementCount > 0) {
                var child = node.firstElementChild;
                node.removeChild(child);
                template.push(child);
            }

            // Add each element in the DOM
            var parsed = 0;
            for (var i = 0; i < value.value.length; i++)
                for (var j = 0; j < template.length; j++) {
                    var ele = template[j].cloneNode(true);

                    parsed = mvvm.applyBindings(value.value[i], ele, model);
                    value.value[i].parent = model;
                    node.appendChild(ele);
                }

            value.anchors.push(node);
            value.templates.push(template);
            value.parents.push(model);

            // Return the number of elements we parsed for one instance
            // This allows us to skip the bindings within the template
            return parsed;
        }

        value.push = function(model) {
            value.value.push(model);

            // Add each element in the DOM for each templates
            for (var i = 0; i < value.templates.length; i++)
                for (var j = 0; j < value.templates[i].length; j++) {
                    var ele = value.templates[i][j].cloneNode(true);

                    mvvm.applyBindings(model, ele, value.value[i].parent);
                    value.anchors[i].appendChild(ele);
                }
        }

        value.value = initial;

        return value;
    }



    // Parse the document datamodel and identyify the necessary bindings
    this.applyBindings = function(data, ele, parent) {
        data.parent = parent;

        // By default; we want to to work on the entire document
        if (ele == null)
            ele = document.body;

        // Scan the document for bindings
        var elements = ele.querySelectorAll('[data-bind]');

        // For each elements        
        for (var i = 0; i < elements.length; i++) {
            var binds = elements[i].dataset.bind.split(/[,:] */);

            // For each binds:data pair
            for (var j = 0; j < binds.length; j += 2) {
                // Array handling requires special casing
                if (binds[j] === 'foreach') {
                    var jump = data[binds[j + 1]].setTemplate(elements[i], data);
                    i += jump
                }

                // If this is an observable; append the dependency
                else {
                    var model = data;
                    var attrib = binds[j + 1];

                    // Figure out which data model the data belongs to
                    var period = binds[j + 1].indexOf('.');
                    if (period != -1) {
                        var allowed = {
                            "data": data,
                            "parent": parent,
                        };

                        var name = binds[j + 1].substring(0, period);
                        if (allowed.hasOwnProperty(name)) {
                            model   = allowed[name];
                            attrib  = binds[j + 1].substring(period + 1);
                        }
                    }

                    // Does the data exist in the data model?
                    if (model.hasOwnProperty(attrib)) {
                        // If it's observable; add the dependency
                        if (typeof model[attrib].addDep === 'function')
                            model[attrib].addDep(elements[i], binds[j]);

                        // Otherwise; write in the static values
                        else if (typeof model[attrib] === 'function')
                            elements[i][binds[j]] = function() { return model[attrib](data); }
                        else
                            elements[i][binds[j]] = model[attrib];
                    }
                }
            }
        }

        return elements.length;
    }

    var obsfnc = {
        "[object Number]":      this.obsProperty,
        "[object String]":      this.obsProperty,
        "[object Boolean]":     this.obsProperty,
        "[object Function]":    this.obsFunction,
        "[object Array]":       this.obsArray
    };
};
