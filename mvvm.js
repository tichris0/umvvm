/*
   Copyright © 2013 Christopher Tremblay. All Rights Reserved.

   Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

   3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED BY [LICENSOR] "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 */

var man = null;

var mvvm = new function() {
    var record          = null; // Variable to record into
    var parentObjNode   = null; // Parent Object Node



    // Master observable property
    this.obs = function(initial, tag) {
        var fnc = null;

        // If it's an object; look at it's type
        if ((initial != null) && (obsfnc.hasOwnProperty(Object.prototype.toString.call(initial)))) {
            fnc = obsfnc[Object.prototype.toString.call(initial)];

            var val = fnc.apply(this, arguments);

            if (tag != null)
                val.tag = tag;

            return val;

        } else
            console.log("We currently don't support dynamic binding");

        return null;
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

        // Function to update itself & the dependents
        value.update = function() {
            // Scan the list of DOM dependencies and update the elements (downwards)
            for (var i = 0; i < value.domDeps.length; i++)
                value.domDeps[i].element[value.domDeps[i].key] = value.value;

            // Scan the list of functions and update them (upwards)
            for (var i = 0; i < value.fncDeps.length; i++)
                value.fncDeps[i].update();
        }

        // Adds a DOM element's dependency on this obs
        value.addDOM = function(dep, key) {
            if (parentObjNode != null)
                parentObjNode.deps.push([value, dep, key]);

            // We're adding a DOM dependency
            value.domDeps.push({   "element": dep, "key": key   });

            // Initialize the value
            dep[key] = value.value;
        }

        // Remove a dependency for a function
        value.remDep = function(dep, key) {
            // No key implies we're removing a function
            if (key == null)
                value.fncDeps.splice(value.fncDeps.indexOf(dep), 1);
            // Otherwise it's a DOM node dependency
            else
                value.domDeps.splice(value.domDeps.indexOf({   "element": dep, "key": key   }));
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

        // Adds dependents of this function (ie: in recording mode)
        value.addDep = function(dep) {
            value.deps.push(dep);
        }

        // Function to update itself & the dependents (downwards)
        value.update = function() {
            // Update self
            if (value.fnc)
                value.set(value.fnc);

            // Update dependents
            value.base.update();
        }

        // Function to set the value
        value.set = function(val) {
            // First remove all previous dependencies since they could change
            while (value.deps.length)
                value.deps.pop().remDep(value);

            // Find the dependencies
            var old     = record;
            record      = value;
            value.fnc   = val;
            value.base.set(arguments[0]());
            record      = old;
        };

        value.set(initial);

        return value;
    })



    // Observable objects
    /*
     *  We shamelessly add the following properties to DOM nodes for dependency tracking:
     *
     *  "anchors":      [Array of JSON object]
     *      "node":     Child DOM node templated through obsObject
     *      "parent":   Parent Model-View
     *  "deps":         [Array of arrays:]
     *      [0]:        obsProperty instance
     *      [1]:        DOM element
     *      [2]:        Element key
     *  "obsDeps":      [Array of child obsObject]
    */
    this.obsObject = function(initial) {
        var nodes = [];     // Array of all anchors generated by this template

        // Function to return the value
        function value() {
            // An argument means that we are setting it
            if (arguments.length != 0)
                value.set(arguments[0]);

            return value.value;
        }

        // Function to remove all dependencies given the owner node
        value.remDeps = function(owner, remObs) {
            // Clean up the parent's node list before we nuke this node
            if (remObs) {
                var index = 0;

                // indexOf() within a JSON object
                for (index = 0; (index < nodes.length) && (nodes[index].node != owner); index++);

                // DEBUG: Sanity check
                if (index ==  nodes.length)
                    console.log("Error: Dependency integrity is broken");

                nodes.splice(index, 1);
            }

            if (!owner.hasOwnProperty('deps')) {
                // DEBUG: Sanity check
                if (owner.obsDeps.length > 0)
                    console.log("That doesn't seem right!");
                return;
            }

            var deps = owner.deps;

            // First; remove the DOM dependencies
            while (deps.length) {
                var data = deps.pop();

                data[0].remDep(data[1], data[2]);
            }

            delete owner.deps;

            // Then parse & remove sub-obsObject dependencies
            deps = owner.obsDeps;
            while (deps.length) {
                var obs     = deps.pop();
                var anchors = owner.anchors;

                for (var i = 0; i < anchors.length; i++)
                    obs.remDeps(anchors[i].node, true);
            }

            delete owner.obsDeps;
            delete owner.anchors;
        }

        // Sets the anchor point of this observable object
        value.setTemplate = function(model, node, parentModel) {
            node.anchors    = [];
            node.deps       = [];
            node.obsDeps    = [];

            var data = {
                "node":         node,       // Node used to populate this template
                "parent":       parentModel // Parent model of this node's model
            };

            // Store the set of children nodes (Seperated by parentObj)
            if (parentObjNode) {
                // Append the object to the parent's obsObject dependency list
                parentObjNode.anchors.push(data);

                if (parentObjNode.obsDeps.indexOf(value) == -1)
                    parentObjNode.obsDeps.push(value);
            }

            nodes.push(data);

            var old         = parentObjNode;
            parentObjNode   = node;
            var jump        = mvvm.applyBindings(model, node, parentModel);
            parentObjNode   = old;

            return jump
        }

        // Function to set the value (Downwards)
        value.set = function(model) {
            value.value     = model;

            for (var i = 0; i < nodes.length; i++) {
                // Remove all previous dependencies since they could change
                var ele  = nodes[i];
                var node = ele.node;

                value.remDeps(node);

                // Then re-bind the data to the node
                node.anchors    = [];
                node.deps       = [];
                node.obsDeps    = [];

                var old         = parentObjNode;
                parentObjNode   = node;
                mvvm.applyBindings(model, node, ele);
                parentObjNode   = old;
            }
        }

        value.set(initial)

        return value;
    }



    // Observable array
    // FIXME: This is a poor man's implementation of the array.  It won't work with many things
    this.obsArray = function(initial) {
        value.anchors   = [];   // List of DOM anchor points for the template
        value.templates = [];   // List of templates
        value.parents   = [];   // List of parent models

        // Function to return the value
        function value() {
            return value.value;
        }

        value.setTemplate = function(model, node) {
            var template = [];
            var parsed = 0;

            // If this is an empty array; we still want to know how many binds are within it
            if (!value.value.length) {
                parsed += node.querySelectorAll('[data-bind]').length;

                // Build the parent list
            }

            // First; extract the template as a reference
            while (node.childElementCount > 0) {
                var child = node.firstElementChild;
                node.removeChild(child);
                template.push(child);
            }

            // Add each element in the DOM
            for (var i = 0; i < value.value.length; i++)
                for (var j = 0; j < template.length; j++) {
                    var ele = template[j].cloneNode(true);

                    parsed = mvvm.applyBindings(value.value[i], ele, model, true);
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

                    mvvm.applyBindings(model, ele, value.value[i].parent, true);
                    value.anchors[i].appendChild(ele);
                }
        }

        value.value = initial;

        return value;
    }



    // Parse the document datamodel and identyify the necessary bindings
    this.applyBindings = function(data, ele, parent, parseParent) {
        data.parent = parent;

        // By default; we want to to work on the entire document
        if (ele == null)
            ele = document.body;

        // Scan the document for bindings
        var nodelist = ele.querySelectorAll('[data-bind]');

        var elements = [];

        if (parseParent && ele.dataset.hasOwnProperty('bind'))
            elements.push(ele);

        for (var i = 0; i < nodelist.length; i++)
            elements.push(nodelist[i]);

        // For each elements        
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var binds = element.dataset.bind.split(/[,:] */);

            // For each binds:data pair
            for (var j = 0; j < binds.length; j += 2) {
                // Array handling requires special casing
                if (binds[j] === 'foreach')
                    i += data[binds[j + 1]].setTemplate(data, element);

                // Child object handling
                else if (binds[j] === 'with') {
                    var model = typeof data[binds[j + 1]] === 'function' ? data[binds[j + 1]]() : data[binds[j + 1]];

                    i += data[binds[j + 1]].setTemplate(model, element, data);
                }

                // If this is an observable; append the dependency
                else {
                    var model = data;
                    var attrib = binds[j + 1];

                    // Figure out which data model the data belongs to
                    var period = binds[j + 1].indexOf('.');
                    if (period != -1) {
                        var allowed = {
                            "data":     data,
                            "parent":   parent,
                        };

                        var name = binds[j + 1].substring(0, period);
                        if (allowed.hasOwnProperty(name)) {
                            model   = allowed[name];
                            attrib  = binds[j + 1].substring(period + 1);

                            if (model == null)
                                console.log("model can't be null");
                        }
                    }

                    // Does the data exist in the data model?
                    if (model.hasOwnProperty(attrib)) {
                        var target  = element;
                        var prop   = binds[j];

                        // Process any nested member definition
                        while ((period = prop.indexOf('.')) != -1) {
                            target = target[prop.substring(0, period)];
                            prop   = prop.substring(period + 1);
                        }

                        // If it's observable; add the dependency
                        if (typeof model[attrib].addDOM === 'function')
                            model[attrib].addDOM(target, prop);

                        // Otherwise; write in the static values
                        else {
                            if (typeof model[attrib] === 'function')
                                target[prop] = function() { return model[attrib](data, element); }
                            else
                                target[prop] = model[attrib];
                        }
                    }
                }
            }
        }

        return elements.length;
    }

    // Observer handler mapping
    var obsfnc = {
        "[object Number]":      this.obsProperty,
        "[object String]":      this.obsProperty,
        "[object Boolean]":     this.obsProperty,
        "[object Function]":    this.obsFunction,
        "[object Array]":       this.obsArray,
        "[object Object]":      this.obsObject,
    };
};
