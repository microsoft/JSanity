if ( typeof jSanity !== 'undefined' ) throw ( "jSanity has been defined, please check if there's any duplicate reference." );

jSanity = {};

( function ( ns ) {
    "use strict";

    // Default sanitization options
    var defaults = {
        version: '0.3',
        inputString: '', // The string to sanitize and put into the DOM
        maxWidth: '600px', // Recommended to prevent outside UI from being pushed to the right
        maxHeight: '200px', // Recommended to prevent outside UI from being pushed down
        overflow: 'hidden', // Recommended to be set set to 'hidden' or 'scroll' so that sanitized content is
        //  constrained to the target element's box
        allowLinks: true, // Allow links (applies where user interaction is required, eg: anchors)
        linkClickCallback: null, // Code that will run in the onclick for any links
        customProtocols: {}, // Additional protocol schemes to allow through sanitization
        allowRelativeURLs: false, // Implementation TBD
        allowAudioVideo: false, // Allow HTML5 AUDIO and VIDEO elements
        unsupportedContentCallback: null, // Callback for unsupported content, such as elements/attributes/styles
        externalContentCallback: // Callback to handle URLs referencing external content
        // Caller should override this function with a more appropriate one given the hosting scenario
            function ( context, name, data, knownProtocols ) {
            var validatedProtocol;

            // Allow SRC attributes through by default, block other external references
            if ( ( context === "attribute" ) && ( name === "src" ) ) {
                for ( var protocol in knownProtocols ) {
                    if ( !knownProtocols.hasOwnProperty( protocol ) ) {
                        continue; // Skip any properties on the prototype
                    }

                    if ( data.substring( 0, protocol.length ) === protocol ) {
                        validatedProtocol = true;
                        break;
                    }
                }
            }

            if ( !validatedProtocol ) {
                // Important to return data in the CSS URL format as necessary, otherwise in directModifySource mode the property won't be overridden
                if ( context === "CSSURL" ) {
                    data = "url(\"about:blank\")";
                } else {
                    data = "about:blank";
                }
            }

            return data;
        },
        isolatedTargetDOM: false, // Should have no impact on sanitization in practice, only performance
        directModifySource: true, // Do not maintain a destination DOM, rather modify the source DOM directly (for perf, requires non-isolated target DOM)

        attributePrefix: 'jSanity', // Prefix NAME and ID attributes with this string
        //  The ID of the target element is also used in the prefix, if there is one
        dataAttributeCallback: null, // Callback for handling of data-* attributes which are otherwise unsafe by default
        debugLevel: 0, // Debug level > 0 will log dropped elements, attributes, etc. to the console
        onFinishedCallback: null // Callback method with purified DOM tree as parameter, if this property be set, then the sanitize will be a asynchronize call,
            // Otherwise this will be a synchronize call
    };

    var schedulerClass = function () {
        this.sync = true;
        this.jobs = [];
        this.id = schedulerClass.globalId++;
        this.listnerPosfix = 0;
        this.onCompletedListners = {};
        this.onNewJobAddedListners = {};

        this.useSync = function () {
            this.sync = true;
        };

        this.useAsync = function () {
            this.sync = false;
        };

        this.addNewJob = function ( fn ) {
            this.jobs.push( fn );

            for ( var key in this.onNewJobAddedListners ) {
                if ( this.onNewJobAddedListners.hasOwnProperty( key ) ) {
                    try {
                        this.onNewJobAddedListners[ key ]( fn );
                    } catch ( e ) {}
                }
            }
        };

        this.registerOnJobCompleted = function ( callback ) {
            var handler;
            this.listnerPosfix += 1;
            handler = this.id.toString() + this.listnerPosfix.toString();
            this.onCompletedListners[ handler ] = callback;
            return handler;
        };

        this.registerOnNewJobAdded = function ( callback ) {
            var handler;
            this.listnerPosfix += 1;
            handler = this.id.toString() + this.listnerPosfix.toString();
            this.onNewJobAddedListners[ handler ] = callback;
            return handler;
        };

        this.unRegisterListner = function ( handlerId ) {
            if ( this.onCompletedListners[ handlerId ] ) {
                delete this.onCompletedListners[ handlerId ];
            } else if ( this.onNewJobAddedListners[ handlerId ] ) {
                delete this.onNewJobAddedListners[ handlerId ];
            }
        };

        this.run = function () {
            var currJob = null;
            var conti = this.sync;
            var start, end;
            start = new Date().getTime();

            do {
                currJob = this.jobs.pop();

                if ( currJob ) {
                    try {
                        currJob();
                    } catch ( e ) {}
                } else {
                    for ( var key in this.onCompletedListners ) {
                        if ( this.onCompletedListners.hasOwnProperty( key ) ) {
                            try {
                                this.onCompletedListners[ key ]();
                            } catch ( e ) {}
                        }
                    }
                }

                end = new Date().getTime();

                if ( currJob && !this.sync ) {
                    if ( ( end - start ) < schedulerClass.maxExecutionTimeForMergedAsyncJobs ) {
                        conti = true;
                    } else {
                        conti = false;
                    }
                }
            }
            while ( conti && currJob );

            if ( !this.sync && currJob ) {
                var stepMethod = ( function ( method, context ) {
                    return function () {
                        method.apply( context );
                    }
                } )( this.run, this );

                setTimeout( stepMethod, 0 );
            }
        };
    };
    schedulerClass.globalId = 0;
    schedulerClass.maxExecutionTimeForMergedAsyncJobs = 15;

    var jSanityClass = function ( schedulerClass, options ) {
        var sch = new schedulerClass();

        if ( options.onFinishedCallback ) {
            sch.useAsync();
        } else {
            sch.useSync();
        }

        // Define the known HTML elements and attributes for various namespaces
        //  TBD: Continue to fill these out
        // Attributes are not currently tied to specific elements, so watch out for attributes with different
        //  meanings depending on the attribute on which they are applied
        var knownHTML = {

            'default': {
                knownElements: {
                    // Groupings borrowed from https://developer.mozilla.org/en-US/docs/HTML/HTML5/HTML5_element_list

                    // Root element
                    'html': 1,

                    // Document metadata
                    'style': 1,

                    // Scripting
                    'noscript': 1,

                    // Sections
                    'body': 1,
                    'section': 1,
                    'nav': 1,
                    'article': 1,
                    'aside': 1,
                    'h1': 1,
                    'h2': 1,
                    'h3': 1,
                    'h4': 1,
                    'h5': 1,
                    'h6': 1,
                    'hgroup': 1,
                    'header': 1,
                    'footer': 1,
                    'address': 1,

                    // Grouping content
                    'p': 1,
                    'hr': 1,
                    'pre': 1,
                    'blockquote': 1,
                    'ol': 1,
                    'ul': 1,
                    'li': 1,
                    'dl': 1,
                    'dt': 1,
                    'dd': 1,
                    'figure': 1,
                    'figcaption': 1,
                    'div': 1,

                    // Text-level semantics
                    'a': 1,
                    'em': 1,
                    'strong': 1,
                    'small': 1,
                    's': 1,
                    'cite': 1,
                    'q': 1,
                    'dfn': 1,
                    'abbr': 1,
                    'code': 1,
                    'var': 1,
                    'samp': 1,
                    'kbd': 1,
                    'sub': 1,
                    'sup': 1,
                    'i': 1,
                    'b': 1,
                    'u': 1,
                    'mark': 1,
                    'ruby': 1,
                    'rt': 1,
                    'rp': 1,
                    'bdi': 1,
                    'bdo': 1,
                    'span': 1,
                    'br': 1,
                    'wbr': 1,

                    // Edits
                    'ins': 1,
                    'del': 1,

                    // Embedded content
                    'img': 1,
                    'video': 1,
                    'audio': 1,
                    'source': 1,
                    'map': 1,
                    'area': 1,
                    'svg': 1,
                    'math': 1,

                    // Tabular data
                    'table': 1,
                    'caption': 1,
                    'colgroup': 1,
                    'col': 1,
                    'tbody': 1,
                    'thead': 1,
                    'tfoot': 1,
                    'tr': 1,
                    'td': 1,
                    'th': 1,

                    // Forms
                    'input': 1,
                    'button': 1,
                    'select': 1,
                    'datalist': 1,
                    'optgroup': 1,
                    'option': 1,
                    'textarea': 1,
                    'progress': 1,
                    'meter': 1,

                    // Interactive elements
                    'details': 1,
                    'summary': 1,
                    'command': 1,
                    'menu': 1,

                    // Deprecated but supported by jSanity
                    'center': 1,
                    'font': 1,
                },

                // Notable elements explicitly not on this list
                // form [due to phishing potential], isindex, frame, iframe, script, embed, object, param...

                // TBD (Possibly unsafe, possibly just unnecessary, ???):
                // head, title, base, link, meta, xmlns, version, track, canvas, keygen, output, label, legend, fieldset

                knownAttributes: {
                    // Global attributes borrowed from https://developer.mozilla.org/en-US/docs/HTML/Global_attributes
                    'class': 1,
                    'contenteditable': 1,
                    'dir': 1,
                    'hidden': 1,
                    'id': 1,
                    'lang': 1,
                    'spellcheck': 1,
                    'tabindex': 1,
                    'title': 1,

                    // Style element [not supported currently]
                    //  If/when supported, consider adding attributes from https://developer.mozilla.org/en-US/docs/HTML/Element/style

                    // Attributes in support of various standard elements
                    'cite': 1,
                    'reversed': 1,
                    'start': 1,
                    'value': 1,
                    'href': 1,
                    'hreflang': 1,
                    'rel': 1,
                    'datetime': 1,
                    'alt': 1,
                    'height': 1,
                    'ismap': 1,
                    'src': 1,
                    'width': 1,
                    'usemap': 1,
                    'autoplay': 1,
                    'controls': 1,
                    'loop': 1,
                    'muted': 1,
                    'preload': 1,
                    'coords': 1,
                    'shape': 1,
                    'span': 1,
                    'colspan': 1,
                    'headers': 1,
                    'rowspan': 1,
                    'scope': 1,
                    'checked': 1,
                    'disabled': 1,
                    'max': 1,
                    'maxlength': 1,
                    'min': 1,
                    'name': 1,
                    'placeholder': 1,
                    'readonly': 1,
                    'selectiondirection': 1,
                    'size': 1,
                    'step': 1,
                    'selectedindex': 1,
                    'label': 1,
                    'selected': 1,
                    'cols': 1,
                    'rows': 1,
                    'selectionend': 1,
                    'selectionstart': 1,
                    'wrap': 1,
                    'low': 1,
                    'high': 1,
                    'optimum': 1,
                    'open': 1,

                    // Deprecated but supported by jSanity
                    'align': 1,
                    'face': 1,
                    'hspace': 1,
                    'vspace': 1,
                    'border': 1,
                    'cellpadding': 1,
                    'cellspacing': 1
                }

                // Explicitly unsafe attributes:
                // on*, accesskey, manifest, form, formaction...

                // TBD (Possibly unsafe, possibly just unnecessary, ???):
                // contextmenu [may abuse existing menus on the page?], draggable, dropzone, download,
                //  media [different for different elements], ping,
                //  target [We should implement a callback to allow hosts to validate], type, crossorigin,
                //  type [for source element at minimum, for input element as well, command element?, menu element?],
                //  accept, autocomplete, autofocus, autosave, formenctype, formmethod, formnovalidate, formtarget,
                //  list, multiple, pattern, required, radiogroup

                // TBD (Add with a callback)
                // poster [for the video element, add with callback to regulate the supplied URL], icon

                // The style attribute is handled separately
            },

            // Attributes on Math, SVG and potentially other elements should be under their respective namespaces

            // SVG namespace
            // TBD
            'http://www.w3.org/2000/svg': {
                knownElements: {
                    'a': 1,
                    'altGlyph': 1,
                    'altGlyphDef': 1,
                    'altGlyphItem': 1,
                    'circle': 1,
                    'clipPath': 1,
                    'defs': 1,
                    'desc': 1,
                    'ellipse': 1,
                    'feBlend': 1,
                    'feColorMatrix': 1,
                    'feComponentTransfer': 1,
                    'feComposite': 1,
                    'feConvolveMatrix': 1,
                    'feDiffuseLighting': 1,
                    'feDisplacementMap': 1,
                    'feDistantLight': 1,
                    'feFlood': 1,
                    'feFuncA': 1,
                    'feFuncB': 1,
                    'feFuncG': 1,
                    'feFuncR': 1,
                    'feGaussianBlur': 1,
                    'feMerge': 1,
                    'feMergeNode': 1,
                    'feMorphology': 1,
                    'feOffset': 1,
                    'fePointLight': 1,
                    'feSpecularLighting': 1,
                    'feSpotLight': 1,
                    'feTile': 1,
                    'feTurbulence': 1,
                    'filter': 1,
                    'font': 1,
                    'g': 1,
                    'glyph': 1,
                    'glyphRef': 1,
                    'hkern': 1,
                    'image': 1,
                    'line': 1,
                    'linearGradient': 1,
                    'marker': 1,
                    'mask': 1,
                    'metadata': 1,
                    'mpath': 1,
                    'path': 1,
                    'pattern': 1,
                    'polygon': 1,
                    'polyline': 1,
                    'radialGradient': 1,
                    'rect': 1,
                    'stop': 1,
                    'style': 1,
                    'svg': 1,
                    'switch': 1,
                    'symbol': 1,
                    'text': 1,
                    'textPath': 1,
                    'title': 1,
                    'tref': 1,
                    'tspan': 1,
                    'view': 1,
                    'vkern': 1
                },
                knownAttributes: {
                    'accumulate': 1,
                    'additive': 1,
                    'alignment-baseline': 1,
                    'amplitude': 1,
                    'ascent': 1,
                    'attributeType': 1,
                    'azimuth': 1,
                    'baseFrequency': 1,
                    'baseline-shift': 1,
                    'bias': 1,
                    'calcMode': 1,
                    'class': 1,
                    'clip': 1,
                    'clip-rule': 1,
                    'clipPathUnits': 1,
                    'color': 1,
                    'color-interpolation': 1,
                    'color-interpolation-filters': 1,
                    'color-rendering': 1,
                    'cx': 1,
                    'cy': 1,
                    'd': 1,
                    'diffuseConstant': 1,
                    'direction': 1,
                    'display': 1,
                    'divisor': 1,
                    'dominant-baseline': 1,
                    'dur': 1,
                    'dx': 1,
                    'dy': 1,
                    'edgeMode': 1,
                    'elevation': 1,
                    'exponent': 1,
                    'fill': 1,
                    'fill-opacity': 1,
                    'fill-rule': 1,
                    'filterUnits': 1,
                    'flood-color': 1,
                    'flood-opacity': 1,
                    'font-family': 1,
                    'font-size': 1,
                    'font-size-adjust': 1,
                    'font-stretch': 1,
                    'font-style': 1,
                    'font-variant': 1,
                    'font-weight': 1,
                    'fx': 1,
                    'fy': 1,
                    'g1': 1,
                    'g2': 1,
                    'glyph-name': 1,
                    'glyphRef': 1,
                    'gradientTransform': 1,
                    'gradientUnits': 1,
                    'height': 1,
                    'id': 1,
                    'image-rendering': 1,
                    'in': 1,
                    'in2': 1,
                    'intercept': 1,
                    'k': 1,
                    'k1': 1,
                    'k2': 1,
                    'k3': 1,
                    'k4': 1,
                    'kernelMatrix': 1,
                    'kernelUnitLength': 1,
                    'kerning': 1,
                    'keyPoints': 1,
                    'lang': 1,
                    'lengthAdjust': 1,
                    'letter-spacing': 1,
                    'lighting-color': 1,
                    'limitingConeAngle': 1,
                    'local': 1,
                    'markerHeight': 1,
                    'markerUnits': 1,
                    'markerWidth': 1,
                    'maskContentUnits': 1,
                    'maskUnits': 1,
                    'max': 1,
                    'media': 1,
                    'method': 1,
                    'min': 1,
                    'mode': 1,
                    'name': 1,
                    'numOctaves': 1,
                    'offset': 1,
                    'opacity': 1,
                    'operator': 1,
                    'order': 1,
                    'orient': 1,
                    'orientation': 1,
                    'origin': 1,
                    'overflow': 1,
                    'path': 1,
                    'pathLength': 1,
                    'patternContentUnits': 1,
                    'patternTransform': 1,
                    'patternUnits': 1,
                    'points': 1,
                    'pointsAtX': 1,
                    'pointsAtY': 1,
                    'pointsAtZ': 1,
                    'preserveAlpha': 1,
                    'preserveAspectRatio': 1,
                    'primitiveUnits': 1,
                    'r': 1,
                    'radius': 1,
                    'refX': 1,
                    'refY': 1,
                    'repeatCount': 1,
                    'repeatDur': 1,
                    'restart': 1,
                    'result': 1,
                    'rotate': 1,
                    'rx': 1,
                    'ry': 1,
                    'scale': 1,
                    'seed': 1,
                    'shape-rendering': 1,
                    'slope': 1,
                    'specularConstant': 1,
                    'specularExponent': 1,
                    'spreadMethod': 1,
                    'startOffset': 1,
                    'stdDeviation': 1,
                    'stitchTiles': 1,
                    'stop-color': 1,
                    'stop-opacity': 1,
                    'stroke': 1,
                    'stroke-dasharray': 1,
                    'stroke-dashoffset': 1,
                    'stroke-linecap': 1,
                    'stroke-linejoin': 1,
                    'stroke-miterlimit': 1,
                    'stroke-opacity': 1,
                    'stroke-width': 1,
                    'style': 1,
                    'surfaceScale': 1,
                    'systemLanguage': 1,
                    'tableValues': 1,
                    'targetX': 1,
                    'targetY': 1,
                    'text-anchor': 1,
                    'text-decoration': 1,
                    'text-rendering': 1,
                    'textLength': 1,
                    'transform': 1,
                    'type': 1,
                    'u1': 1,
                    'u2': 1,
                    'unicode-bidi': 1,
                    'values': 1,
                    'vert-adv-y': 1,
                    'vert-origin-x': 1,
                    'vert-origin-y': 1,
                    'viewBox': 1,
                    'visibility': 1,
                    'width': 1,
                    'word-spacing': 1,
                    'writing-mode': 1,
                    'x': 1,
                    'x1': 1,
                    'x2': 1,
                    'xChannelSelector': 1,
                    'y': 1,
                    'y1': 1,
                    'y2': 1,
                    'yChannelSelector': 1,
                    'z': 1,
                    'zoomAndPan': 1,
                }
            }

            // Math namespace
            // TBD
        };

        var knownProtocols = {
            'http://': 1,
            'https://': 1,
            'ftp://': 1,
            'mailto:': 1
        };

        var knownCSSProperties = {
            // CSS Properties borrowed from http://www.w3schools.com/cssref/default.asp

            // Animation properties
            // TBD

            // Background properties
            'background-attachment': 1,
            'background-color': 1,
            'background-image': 1,
            'background-position': 1,
            'background-repeat': 1,
            'background-clip': 1,
            'background-origin': 1,
            'background-size': 1,

            // Border and outline properties
            'border': 1,
            'border-bottom': 1,
            'border-bottom-color': 1,
            'border-bottom-style': 1,
            'border-bottom-width': 1,
            'border-color': 1,
            'border-left': 1,
            'border-left-color': 1,
            'border-left-style': 1,
            'border-left-width': 1,
            'border-right': 1,
            'border-right-color': 1,
            'border-right-style': 1,
            'border-right-width': 1,
            'border-style': 1,
            'border-top': 1,
            'border-top-color': 1,
            'border-top-style': 1,
            'border-top-width': 1,
            'border-width': 1,
            'outline': 1,
            'outline-color': 1,
            'outline-style': 1,
            'outline-width': 1,
            'border-bottom-left-radius': 1,
            'border-bottom-right-radius': 1,
            'border-radius': 1,
            'border-top-left-radius': 1,
            'border-top-right-radius': 1,
            'box-decoration-break': 1,
            'box-shadow': 1,

            // Box properties
            'overflow-x': 1,
            'overflow-y': 1,
            'overflow-style': 1,
            'rotation': 1,
            'rotation-point': 1,

            // Color properties
            'opacity': 1,
            // Other color properties TBD

            // Content for paged media properties
            // TBD

            // Dimension properties
            'height': 1,
            'max-height': 1,
            'max-width': 1,
            'min-height': 1,
            'min-width': 1,
            'width': 1,

            // Flexible box properties
            'box-align': 1,
            'box-direction': 1,
            'box-flex': 1,
            'box-flex-group': 1,
            'box-lines': 1,
            'box-ordinal-group': 1,
            'box-orient': 1,
            'box-pack': 1,

            // Font properties
            'font': 1,
            'font-family': 1,
            'font-size': 1,
            'font-style': 1,
            'font-variant': 1,
            'font-weight': 1,
            'font-size-adjust': 1,
            'font-stretch': 1,

            // Generated Content Properties
            // TBD, seems scary to support...

            // Grid properties
            'grid-columns': 1,
            'grid-rows': 1,

            // Hyperlink properties
            // TBD, will require callback support consistent with target attribute

            // Linebox properties
            // TBD

            // List properties
            // TBD, will require callback support for image

            // Margin properties
            'margin': 1,
            'margin-bottom': 1,
            'margin-left': 1,
            'margin-right': 1,
            'margin-top': 1,

            // Marquee properties
            // TBD

            // Multi-column properties
            'column-count': 1,
            'column-fill': 1,
            'column-gap': 1,
            'column-rule': 1,
            'column-rule-color': 1,
            'column-rule-style': 1,
            'column-rule-width': 1,
            'column-span': 1,
            'column-width': 1,
            'columns': 1,

            // Padding properties
            'padding': 1,
            'padding-bottom': 1,
            'padding-left': 1,
            'padding-right': 1,
            'padding-top': 1,

            // Paged media properties
            // TBD

            // Positioning properties
            'bottom': 1,
            'clear': 1,
            'clip': 1,
            'display': 1,
            'float': 1,
            'left': 1,
            'overflow': 1,
            'position': 1, // The value of position is regulated in code below so as to mitigate overlay attacks
            'right': 1,
            'top': 1,
            'visibility': 1,
            'z-index': 1,

            // Print properties
            // TBD

            // Ruby properties
            // TBD

            // Speech properties
            // TBD

            // Table properties
            'border-collapse': 1,
            'border-spacing': 1,
            'caption-side': 1,
            'empty-cells': 1,
            'table-layout': 1,

            // Text properties
            'color': 1,
            'direction': 1,
            'letter-spacing': 1,
            'line-height': 1,
            'text-align': 1,
            'text-decoration': 1,
            'text-indent': 1,
            'text-transform': 1,
            'unicode-bidi': 1,
            'vertical-align': 1,
            'white-space': 1,
            'word-spacing': 1,
            'hanging-punctuation': 1,
            'punctuation-trim': 1,
            'text-align-last': 1,
            'text-justify': 1,
            'text-outline': 1,
            'text-shadow': 1,
            'text-wrap': 1,
            'word-break': 1,
            'word-wrap': 1,

            // 2D/3D transform properties
            // TBD

            // Transition properties
            // TBD

            // User-interface properties
            // TBD (At minimum the icon property will require a callback)

            // TBD (Possibly unsafe, possibly just unnecessary, ???):
            // background [CSS shorthand property not currently implemented, may not actually be necessary, would require parsing],
            // border-image-* [no current browser support (?)]
            // cursor [supports a URL], text-overflow [may allow overlay attack?]

            // SVG
            'alignment-baseline': 1,
            'baseline-shift': 1,
            'clip-rule': 1,
            'color-interpolation': 1,
            'color-interpolation-filters': 1,
            'color-rendering': 1,
            'dominant-baseline': 1,
            'fill-opacity': 1,
            'fill-rule': 1,
            'flood-color': 1,
            'flood-opacity': 1,
            'image-rendering': 1,
            'kerning': 1,
            'lighting-color': 1,
            'shape-rendering': 1,
            'stop-color': 1,
            'stop-opacity': 1,
            'stroke': 1,
            'stroke-dasharray': 1,
            'stroke-dashoffset': 1,
            'stroke-linecap': 1,
            'stroke-linejoin': 1,
            'stroke-miterlimit': 1,
            'stroke-opacity': 1,
            'stroke-width': 1,
            'text-anchor': 1,
            'text-rendering': 1,
            'writing-mode': 1
        }

        // Explicitly unsafe CSS properties:
        // position [position:fixed enables overlay attacks], ...

        // Data to use while walking the tree
        var tw, itemOptions, targetElementID, destDoc, srcDoc;

        var setOnClickArray = [];

        function nodeFilter( node ) {
            //	if (node.nodeType == node.ELEMENT_NODE) alert("element node!  " + node.tagName);
            //	else if (node.nodeType == node.TEXT_NODE) alert("text node!  " + node.nodeValue);
            //	else alert("unknown node type!");

            return NodeFilter.FILTER_ACCEPT;
        }

        function consoleLog( level, message ) {
            if ( ( window.console ) && ( itemOptions.debugLevel >= level ) ) {
                console.log( "jSanity: " + message );
            }
        }

        function createWalkerJob( contextNode, ns, destElt ) {
            return function walkerJob() {
                var savedCurrentNode = tw.currentNode;
                tw.currentNode = contextNode;
                treeWalk( ns, destElt );
                tw.currentNode = savedCurrentNode;
            }
        }

        function scheduleNewWalkerJob( contextNode, ns, destElt ) {
            var job = createWalkerJob( contextNode, ns, destElt );
            sch.addNewJob( job );
        }

        function treeWalk( ns, destElt ) {
            var savedCurrentNode, cElt, tagN, oldNS, killElt, validatedProtocol, fullPrefix, output, outAttribute, attN;

            savedCurrentNode = tw.currentNode;
            var nodesToRemove = new Array();
            var setOnclick;
            var modifiedProperty;
            var childStyle;

            for ( var child = tw.firstChild(); child !== null; child = tw.nextSibling() ) {
                switch ( child.nodeType ) {
                    case child.ELEMENT_NODE:
                        // Operate on elements that are known (allow-listed) for the current namespace
                        tagN = child.tagName.toLowerCase();
                        if ( tagN in knownHTML[ ns ].knownElements ) {
                            // Preserve the current namespace as it may change for the element we are about to traverse
                            oldNS = ns;

                            // It may not be explicitly specified in the markup, but SVG elements have their own namespace
                            if ( tagN === "svg" ) {
                                ns = "http://www.w3.org/2000/svg";
                            }

                            // Create a new element appropriately in the destination document
                            if ( !itemOptions.directModifySource ) {
                                if ( ns == "default" ) {
                                    cElt = destDoc.createElement( tagN );
                                } else {
                                    cElt = destDoc.createElementNS( ns, tagN );
                                }
                            } else {
                                cElt = child;
                            }

                            // Flag to cancel adding this element into the DOM
                            killElt = false;

                            if ( !itemOptions.allowAudioVideo && ( ( tagN === "video" ) || ( tagN === "audio" ) || ( tagN === "source" ) ) ) {
                                killElt = true;
                            }

                            if ( tagN === "style" ) {
                                // In directModifySource mode the style element actually makes it through.  For now let's just explicitly kill it.
                                killElt = true;

                                // if (cElt.sheet !== null) {
                                // Unfortunately on Chrome and FF, document.implementation.createHTMLDocument does not
                                //  create CSSStyleSheet objects.  Hopefully this will change in the future.

                                // And in IE, while we can get cElt.sheet.cssRules, it is empty
                                // This is not a problem if we attempt to pull the stylesheet from the srcDoc as a whole
                                //  See code at the bottom of the main sanitization loop (outside of the treeWalk)
                                // }
                            }


                            if ( !killElt ) {
                                setOnclick = null;
                                for ( var i = 0; i < child.attributes.length; i++ ) {

                                    // var tempString1 = tagN + ": ";
                                    // for (var j = 0; j < child.attributes.length; j++) {
                                    //     tempString1 += child.attributes[j].name + ", ";
                                    // }
                                    // alert(tempString1);

                                    // Handle known attributes
                                    attN = child.attributes[ i ].name.toLowerCase();
                                    if ( attN in knownHTML[ ns ].knownAttributes ) {
                                        // Link handling
                                        if ( attN === "href" ) {
                                            validatedProtocol = false;
                                            if ( itemOptions.allowLinks ) {
                                                for ( var protocol in knownProtocols ) {
                                                    if ( !knownProtocols.hasOwnProperty( protocol ) ) {
                                                        continue; // Skip any properties on the prototype
                                                    }

                                                    if ( child.attributes[ i ].value.substring( 0, protocol.length ) === protocol ) {
                                                        validatedProtocol = true;
                                                        cElt.setAttribute( "href", child.attributes[ i ].value );

                                                        if ( itemOptions.linkClickCallback !== null ) {
                                                            // This link must be re-activated later to pass through to the page DOM
                                                            setOnclick = "/*jSanityClickCallback*/";
                                                        }
                                                        break;
                                                    }
                                                }
                                            }

                                            if ( !validatedProtocol ) {
                                                // Link didn't pass validation, allow the link but make it go nowhere

                                                setOnclick = "/*jSanityReturnFalseCallback*/";
                                            }
                                        } else if ( attN === "class" ) {
                                            // Multiple class names can be included in a single attribute, delimited by whitespace
                                            // We should prefix each class name, but this requires parsing
                                            // TBD: Implement a callback to allow callers to handle CLASS attributes, or otherwise parse the CLASS

                                            // For now, just disable CLASS attributes
                                            if ( itemOptions.directModifySource ) {
                                                child.removeAttribute( child.attributes[ i ].name );

                                                // We just removed this attribute so we need to ensure all remaining attributes in the list are still evaluated
                                                i--;
                                            }
                                        } else if ( ( attN === "name" ) || ( attN === "id" ) ) {
                                            // Prefix NAME and ID attributes
                                            fullPrefix = itemOptions.attributePrefix + "_";

                                            // All target element should have an identifier to avoid interference between
                                            //  different chunks of sanitized output.  We pick up the ID to of the target element
                                            //  to use here as a prefix for all NAME/ID attributes in sanitized elements
                                            if ( typeof targetElementID !== "undefined" ) {
                                                fullPrefix += targetElementID + "_";
                                            }

                                            if ( child.attributes[ i ].value.length > 0 ) {
                                                if ( ( child.attributes[ i ].value.length > fullPrefix.length ) && ( child.attributes[ i ].value.substring( 0, fullPrefix.length ) === fullPrefix ) ) {
                                                    // Preserve idempotence -- don't re-prefix if prefixes match exactly
                                                    cElt.setAttribute( child.attributes[ i ].name, child.attributes[ i ].value );
                                                } else {
                                                    cElt.setAttribute( child.attributes[ i ].name, fullPrefix + child.attributes[ i ].value );
                                                }
                                            }
                                        } else if ( attN === "src" ) {
                                            output = child.attributes[ i ].value;
                                            // Deal with external content referenced by the SRC attribute
                                            if ( itemOptions.externalContentCallback !== null ) {
                                                output = itemOptions.externalContentCallback( "attribute", "src", output, knownProtocols );
                                            }

                                            if ( output !== null ) {
                                                cElt.setAttribute( "src", output );
                                            } else {
                                                // Just abort and drop the entire element
                                                killElt = true;
                                                break;
                                            }
                                        } else {
                                            // Default action for known attributes
                                            cElt.setAttribute( child.attributes[ i ].name, child.attributes[ i ].value );
                                        }
                                    } else if ( ( itemOptions.dataAttributeCallback !== null ) && ( attN.substring( 0, 5 ) === "data-" ) ) {
                                        // data-* attributes aren't allowed by default, but may be supported via a custom callback

                                        // Callback accepts the attribute name/value and returns the value to use, or null to kill this attribute
                                        outAttribute = itemOptions.dataAttributeCallback( child.attributes[ i ].name, child.attributes[ i ].value );
                                        if ( outAttribute !== null ) {
                                            try {
                                                cElt.setAttribute( child.attributes[ i ].name, outAttribute );
                                            } catch ( e ) {
                                                consoleLog( 0, 'Unable to set CSS attribute: ' + child.attributes[ i ].name + ' to ' + outAttribute );
                                            };
                                        }
                                    } else {
                                        if ( itemOptions.directModifySource ) {
                                            if ( attN !== "style" ) {
                                                child.removeAttribute( child.attributes[ i ].name );

                                                // We just removed this attribute so we need to ensure all remaining attributes in the list are still evaluated
                                                i--;
                                            }
                                        }

                                        consoleLog( 1, 'Encountered unsupported attribute: ' + attN );
                                        if( itemOptions.unsupportedContentCallback ) {
                                            itemOptions.unsupportedContentCallback( "attribute", attN );
                                        }
                                    }
                                }

                                // Do this late so that we don't affect the loop.  (Issue observed in directModifySource mode.)
                                if ( setOnclick ) {
                                    if ( setOnclick === "/*jSanityReturnFalseCallback*/" ) {
                                        cElt.setAttribute( "href", "#" );
                                    }
                                    cElt.setAttribute( "onclick", setOnclick );
                                    setOnClickArray.push( cElt );
                                }
                            }

                            if ( !killElt && child.style ) {
                                // Apply CSS properties from the style attribute
                                for ( var i = 0; i < child.style.length; i++ ) {
                                    childStyle = child.style[ i ];
                                    if ( childStyle in knownCSSProperties ) {
                                        modifiedProperty = false;
                                        output = child.style.getPropertyValue( childStyle );

                                        if ( output.substring( 0, 4 ) === "url(" ) {
                                            // Deal with external content
                                            if ( itemOptions.externalContentCallback !== null ) {
                                                output = itemOptions.externalContentCallback( "CSSURL", childStyle, output, knownProtocols );
                                                modifiedProperty = true;
                                            }
                                        }

                                        // Fixed and absolute positioning allow overlay attacks
                                        if ( ( childStyle === "position" ) && ( output !== "static" ) && ( output !== "relative" ) && ( output !== "inherit" ) ) {
                                            output = "inherit";
                                            modifiedProperty = true;
                                        }

                                        try {
                                            // Only modify the property if necessary
                                            if ( itemOptions.directModifySource ) {
                                                if ( modifiedProperty ) {
                                                    cElt.style.setProperty( childStyle, output );
                                                }
                                            } else {
                                                cElt.style.setProperty( childStyle, output );
                                            }
                                        } catch ( e ) {
                                            consoleLog( 0, 'Unable to set CSS property: ' + childStyle );
                                        }
                                    } else {
                                        if ( itemOptions.directModifySource ) {
                                            cElt.style.setProperty( childStyle, null );
                                        }

                                        consoleLog( 1, 'Encountered unsupported style property: ' + childStyle );
                                        if( itemOptions.unsupportedContentCallback ) {
                                            itemOptions.unsupportedContentCallback( "style", childStyle );
                                        }
                                    }
                                }
                            }

                            // Element fully constructed, attach it to the DOM being constructed
                            if ( !killElt ) {
                                if ( !itemOptions.directModifySource ) {
                                    destElt.appendChild( cElt );
                                }
                            } else if ( itemOptions.directModifySource ) {
                                nodesToRemove.push( child );
                            }

                            // Traverse the source DOM below the current element, unless we are killing the element
                            if ( !killElt ) {
                                scheduleNewWalkerJob( child, ns, cElt );
                                //treeWalk(ns, cElt);
                            }

                            // Revert back to the previous namespace
                            ns = oldNS;
                        } else {
                            if ( itemOptions.directModifySource ) {
                                nodesToRemove.push( child );
                            }

                            consoleLog( 1, 'Encountered unsupported element: ' + tagN );
                            if( itemOptions.unsupportedContentCallback ) {
                                itemOptions.unsupportedContentCallback( "element", tagN );
                            }
                        }
                        break;

                    case child.TEXT_NODE:
                        // Allow text nodes through

                        if ( !itemOptions.directModifySource ) {
                            cElt = destDoc.createTextNode( child.nodeValue );

                            destElt.appendChild( cElt );
                        }
                        break;

                    case child.COMMENT_NODE:
                        // removeNode() on IE somehow doesn't let comments be removed, so OK, let them pass
                        break;

                    default:
                        if ( itemOptions.directModifySource ) {
                            nodesToRemove.push( child );
                        }

                        // Throwing a hard error here is a bit too draconian
                        consoleLog( 1, 'Unknown node type: ' + child.nodeType );
                }
            }

            // Remove nodes after we're all done because otherwise we remove the node being operated upon, screwing up the node iteration
            for ( i = 0; i < nodesToRemove.length; i++ ) {
                // Need to avoid DOM squatting, eg: test<form><input name=parentNode>  (Credit: Gareth Heyes)
                // Use removeNode() on IE and remove() elsewhere
                //  removeNode() doesn't exist on Chrome, remove() doesn't exist on IE
                // Use removeChild if all else fails.  Example where this is necessary (IE11): 
                //  <svg xmlns="http://www.w3.org/2000/svg"><g onload="javascript:alert(1)"></g></svg>
                try {
                    nodesToRemove[ i ].removeNode( true );
                } catch ( e ) {
                    try {
                        nodesToRemove[ i ].remove();
                    } catch ( e ) {
                        nodesToRemove[ i ].parentNode.removeChild(nodesToRemove[ i ]);
                    }
                }
            }

            tw.currentNode = savedCurrentNode;
        }

        function shadowCopy( output ) {
            if ( !output ) {
                throw "invalid number of parameters. At least one is expected";
            }

            if ( output.toString() != "[object Object]" ) {
                throw "Invalid type of parameter";
            }

            var i = 0;
            var source = null;

            for ( ; i < arguments.length; i++ ) {
                source = arguments[ i ];

                if ( source.toString() != "[object Object]" ) {
                    throw "Invalid type of parameter";
                }

                for ( var key in source ) {
                    if ( source.hasOwnProperty( key ) ) {
                        output[ key ] = source[ key ];
                    }
                }
            }

            return output;
        }
        
        // Prevent DOM clobbering for body, as per https://github.com/Microsoft/JSanity/issues/5
        function safeBody( srcDoc ) {
            if (Object.getOwnPropertyDescriptor(Document.prototype, 'body')) {
                // Webkit
                return Object.getOwnPropertyDescriptor(Document.prototype, 'body').get.call(srcDoc);
            } else {
                // Firefox
                return Object.getOwnPropertyDescriptor(document.__proto__, 'body').get.call(srcDoc);
            }
        }

        this.sanitizeMethod = function sanitizeMethod( options ) {
            var spanBuffer, iSpan, output, i, elem, onclickSet;
            /* , newNode; */

            // Merge options into a new object
            //  Precedence: Options in element data, options in method call, defaults
            itemOptions = shadowCopy( {}, defaults, options );

            // Basic list of known protocols is hardcoded but extensible via options
            shadowCopy( knownProtocols, itemOptions.customProtocols );

            // Set up the destination DOM
            // Currently directModifySource is directly regulated by isolatedTargetDOM
            if ( itemOptions.isolatedTargetDOM ) {
                itemOptions.directModifySource = false;
                destDoc = document.implementation.createHTMLDocument( "destDoc" );
            } else {
                itemOptions.directModifySource = true;
                spanBuffer = document.createElement( "span" );
                destDoc = document;
            }

            // Set up the source DOM
            srcDoc = document.implementation.createHTMLDocument( "sourceDoc" );

            // The tree is constructed under a single span element
            // TBD: Potentially unnecessary, consider removing
            iSpan = srcDoc.createElement( "span" );
            iSpan.innerHTML = itemOptions.inputString;
            safeBody(srcDoc).appendChild( iSpan );

            // Detect DOM clobbering, as per https://github.com/Microsoft/JSanity/issues/5
            if ( srcDoc.createTreeWalker !== Document.prototype.createTreeWalker ) {
                // Sanitize an empty source DOM
                srcDoc = document.implementation.createHTMLDocument( "sourceDoc" );
                iSpan = srcDoc.createElement( "span" );
                srcDoc.body.appendChild( iSpan );
            }

            // Do an inorder traversal, then build up a document fragment and when it's finished attach it into the doc
            // Nodefilter currently disabled for perf (yes, it makes a difference!)
            tw = srcDoc.createTreeWalker( safeBody(srcDoc), NodeFilter.SHOW_ALL, /* nodeFilter */ null, false );

            // targetElementID = $(this).attr('id');
            scheduleNewWalkerJob( tw.currentNode, "default", itemOptions.isolatedTargetDOM ? destDoc.body : spanBuffer );

            var hdler = sch.registerOnJobCompleted( function () {
                if ( itemOptions.isolatedTargetDOM ) {
                    var newNode = document.importNode( destDoc.documentElement, true );
                    output = newNode.lastChild.firstChild;
                } else {
                    if ( itemOptions.directModifySource ) {
                        output = iSpan;
                    } else {
                        output = spanBuffer;
                    }
                }

                for ( i = 0; i < setOnClickArray.length; i++ ) {
                    elem = setOnClickArray[ i ];
                    onclickSet = elem.getAttribute( "onclick" );

                    if ( onclickSet === "/*jSanityClickCallback*/" ) {
                        elem.onclick = itemOptions.linkClickCallback;
                    } else if ( onclickSet === '/*jSanityReturnFalseCallback*/' ) {
                        elem.onclick = function () {
                            return false;
                        };
                    }
                }

                try {
                    output.style.setProperty( "display", "inline-block" );

                    if ( itemOptions.maxWidth ) {
                        output.style.setProperty( "max-width", itemOptions.maxWidth );
                    }

                    if ( itemOptions.maxHeight ) {
                        output.style.setProperty( "max-height", itemOptions.maxHeight );
                    }

                    if ( itemOptions.overflow ) {
                        output.style.setProperty( "overflow", itemOptions.overflow );
                    }
                } catch ( e ) {}

                // Reset the array for the next loop iteration
                setOnClickArray = [];
                sch.unRegisterListner( hdler );

                if ( itemOptions.onFinishedCallback ) {
                    itemOptions.onFinishedCallback( output );
                }
            } );

            sch.run();

            return output;
        }
    }

    var inSupportedEnvironment = ( function () {
        // TODO:
        // Only check for IE, may need better solution for other platform/browsers?
        // https://github.com/ded/bowser is a good one? But that will introduce a new dependency.
        // More reference: http://stackoverflow.com/questions/2400935/browser-detection-in-javascript
        if ( typeof document.documentMode !== "undefined" ) {
            // IE versions < 10 will not properly isolate markup passed in to document.implementation.createHTMLDocument
            if ( document.documentMode < 10 ) {
                return false;
            }
        }

        return true;
    } )();

    ns.isSupport = function () {
        return inSupportedEnvironment;
    }

    // public method expose to external as jSanity.sanitize()
    ns.sanitize = function ( options ) {
        var sanitizer;

        if ( !inSupportedEnvironment ) {
            throw "jSanity does not support run in current browser version.";
        }

        sanitizer = new jSanityClass( schedulerClass, options );

        return sanitizer.sanitizeMethod( options );
    }
} )( jSanity );
