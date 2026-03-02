var EVENTS = {

    _keyMap: {},//Keyboard Map Pressed
    _mouseBtMap: { left: 0, midle: 0, right: 0 },//Mouse buttons Map Pressed
    mousePos: null,
    mouseHPos: null,    
    onClick: null,
    onKeyUp: null,
    onKeyDown: null,
    arrows:[{inc:Math.PI},{inc:Math.PI},10],//used to joystick lerp (left right up dow)

    create: function () {        
        EVENTS.mousePos = new THREE.Vector2();
        EVENTS.mouseHPos = new THREE.Vector2();
        EVENTS._bindEvents();
        EVENTS._startMouseCapture(true);
    },

    _bindEvents: function () {
        $(window).off("mousemove").on("mousemove", EVENTS._onMouseMove);
        $(window).off("keydown").on("keydown", EVENTS._onKeyDown);
        $(window).off("keyup").on("keyup", EVENTS._onKeyUp);
        //redirecting render2(CSS) events to orbitcontrol
        
        function eveBind(func, ev) {
            if (control.orbitCamera.events)if (control.orbitCamera.events[func]) control.orbitCamera.events[func](ev);
        }        
        renderer2.domElement.addEventListener('wheel', event => eveBind('onMouseWheel',event));
        renderer2.domElement.addEventListener('contextmenu', event => eveBind('onContextMenu',event));
        renderer2.domElement.addEventListener('pointerdown', event => eveBind('onPointerDown',event));
        renderer2.domElement.addEventListener('pointermove', event => eveBind('onPointerMove',event));
        renderer2.domElement.addEventListener('pointercancel', event => eveBind('onPointerCancel',event));
        renderer2.domElement.addEventListener('pointerup', event => eveBind('onPointerUp',event));
        renderer2.domElement.addEventListener('keydown', event => eveBind('onKeyDown',event));                        
    },

    _unbindEvents: function () {
        $(window).off("mousemove");
        $(window).off("keydown");
        $(window).off("keyup");
        renderer.domElement.onmouseover = EVENTS._gainLostFocus;
        renderer2.domElement.onmouseover = renderer.domElement.onmouseover;
    },

    _onLostFocus: function (event) {
        EVENTS._unbindEvents();
        EVENTS.unpressKeys();
        EVENTS._mouseBtMap = { left: 0, midle: 0, right: 0, event: EVENTS._mouseBtMap.event };
    },

    _gainLostFocus: function (event) {
        EVENTS._bindEvents();
    },

    _onMouseMove: function (event) {
        // calculate mouse position in normalized device coordinates    
        var cbound = renderer.domElement.getBoundingClientRect();
        EVENTS.mousePos.x =
            ((event.clientX - cbound.left) / (cbound.right - cbound.left)) * 2 - 1;
        EVENTS.mousePos.y =
            -((event.clientY - cbound.top) / (cbound.bottom - cbound.top)) * 2 + 1;
        //used in playerlook        
        EVENTS.mouseHPos.x = (event.clientX - (window.innerWidth / 2));
        EVENTS.mouseHPos.y = (event.clientY - (window.innerHeight / 2));
        //-->ENGINE.GAME._onMouseMove(event);        
    },

    _onCanvasClick: function (event) {
        //Global Use
    },

    _onKeyDown: function (event) {
        event.preventDefault();
        EVENTS._keyMap[event.code] = true;        
        //---> ENGINE.GAME._onKeyDown(ENGINE._keyMap);
        if (typeof (EVENTS.onKeyDown) == 'function') EVENTS.onKeyDown(event.code);
    },

    _onKeyUp: function (event) {
        event.preventDefault();
        EVENTS._keyMap[event.code] = false;
        //ENGINE.GAME._onKeyUp(ENGINE._keyMap);
        if (typeof (EVENTS.onKeyUp) == 'function') EVENTS.onKeyUp(event.code);
    },

    _mouseButtonEvent: function (button, down) {//from transformcontrols pointer
        //original - event.button
        if (typeof (button) == _UN) return;
        if (button == 2)
            EVENTS._mouseBtMap.right = down == 1 ? 1 : 0;
        if (button == 1)
            EVENTS._mouseBtMap.midle = down == 1 ? 1 : 0;
        if (button == 0)
            EVENTS._mouseBtMap.left = down == 1 ? 1 : 0;
        //ENGINE._mouseBtMap.event = event;
        //---> EVENTS.GAME._mouseButtonEvent(ENGINE._mouseBtMap);
        if (typeof (EVENTS.onClick) == 'function') EVENTS.onClick(EVENTS._mouseBtMap);
    },

    _startMouseCapture: function (enabled) {
        //CONTROLS.mouseEvent = ENGINE._mouseButtonEvent;
        if (enabled == true) {
            $(document).off("mousedown").on("mousedown", function (e) {
                if (e.which == 1) {
                    //leftButtonDown = true;
                    EVENTS._mouseButtonEvent(0, 1);
                } else if (e.which == 3) {
                    //rightButtonDown = true;
                    EVENTS._mouseButtonEvent(2, 1);
                }
            });
            $(document).off("mouseup").on("mouseup", function (e) {
                if (e.which == 1) {
                    //leftButtonDown = false;
                    EVENTS._mouseButtonEvent(0, 0);
                } else if (e.which == 3) {
                    //rightButtonDown = false;
                    EVENTS._mouseButtonEvent(2, 0);
                }
            });
            /*document.addEventListener("click", function () {
                if (leftButtonDown && rightButtonDown) {// Click with both LMB and RMB.
                }
            });*/
        } else {
            $(document).off("mouseup");
            $(document).off("mousedown")
        }
    },
}