(function () {
    if (!Date.now) {
        Date.now = function () { return new Date().getTime(); };
    }
    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
        var vp = vendors[i];
        window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = (window[vp + 'CancelAnimationFrame'] || window[vp + 'CancelRequestAnimationFrame']);
    }

    // iOS6 is buggy
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
        var lastTime = 0;
        window.requestAnimationFrame = function (callback) {
            var now = Date.now();
            var nextTime = Math.max(lastTime + 16, now);
            return setTimeout(function () { callback(lastTime = nextTime); }, nextTime - now);
        };
        window.cancelAnimationFrame = clearTimeout;
    }
})();

(function (undef) {
    var _elementStyle = document.createElement('div').style;
    var endTransitionEventName;
    var transitionDuration;
    var transitionTimingFunction;
    var transform;

    if ('transform' in _elementStyle) {
        transform = 'transform';
        endTransitionEventName = 'transitionend';
        transitionDuration = 'transitionDuration';
        transitionTimingFunction = 'transitionTimingFunction';
    } else if ('webkitTransform' in _elementStyle) {
        transform = 'webkitTransform';
        endTransitionEventName = 'webkitTransitionEnd';
        transitionDuration = 'webkitTransitionDuration';
        transitionTimingFunction = 'webkitTransitionTimingFunction';
    } else {
        throw Error('please use a modern browser');
    }

    var ease = 'cubic-bezier(0.1, 0.57, 0.1, 1)';

    function reverseEase (y) {
        return 1 - Math.sqrt(1 - y * y);
    }

    function bind (element, type, callback) {
        element.addEventListener(type, callback, false);
    }

    function unbind (element, type, callback) {
        element.removeEventListener(type, callback);
    }

    function preventDefaultTest (el, exceptions) {
        for (var i in exceptions) {
            if (exceptions[i].test(el[i])) {
                return true;
            }
        }
        return false;
    }
    function noop () { /**/ }

    function AlloyTouch (option) {
        this.scroller = option.target;
        this.element = typeof option.touch === 'string' ? document.querySelector(option.touch) : option.touch;
        this.vertical = this._getValue(option.vertical, true);
        this.property = option.property;
        this.preventDefault = this._getValue(option.preventDefault, true);
        this.sensitivity = this._getValue(option.sensitivity, 1);
        this.lockDirection = this._getValue(option.lockDirection, true);

        this.initialVaule = this._getValue(option.initialVaule, this.scroller[this.property]);
        this.scroller[this.property] = this.initialVaule;

        this.moveFactor = this._getValue(option.moveFactor, 1);
        this.factor = this._getValue(option.factor, 1);
        this.outFactor = this._getValue(option.outFactor, 0.3);

        this.min = option.min;
        this.max = option.max;

        this.maxRegion = this._getValue(option.maxRegion, 60);

        this.deceleration = 0.0006;
        this.maxRegion = this._getValue(option.maxRegion, 600);
        this.springMaxRegion = this._getValue(option.springMaxRegion, 60);

        this.change = option.change || noop;
        this.touchEnd = option.touchEnd || noop;
        this.touchStart = option.touchStart || noop;
        this.touchMove = option.touchMove || noop;
        this.touchCancel = option.touchMove || noop;
        this.animationEnd = option.animationEnd || noop;

        this.preventDefaultException = { tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/ };
        this.hasMin = !(this.min === undef);
        this.hasMax = !(this.max === undef);
        this.isTouchStart = false;
        this.step = option.step;
        this.inertia = this._getValue(option.inertia, true);
        this.maxSpeed = option.maxSpeed;
        this.hasMaxSpeed = !(this.maxSpeed === undef);

        if (this.hasMax && this.hasMin) {
            if (this.min > this.max) {
                throw Error("min value can't be greater than max value");
            }
            this.currentPage = Math.round((this.max - this.scroller[this.property]) / this.step);
        }

        this._startHandler = this._start.bind(this);
        this._moveHandler = this._move.bind(this);
        this._transitionEndHandler = this._transitionEnd.bind(this);
        this._endHandler = this._end.bind(this);
        this._cancelHandler = this._cancel.bind(this);
        this._tick = this._tick.bind(this);
        this._stop = this._stop.bind(this);

        bind(this.element, 'touchstart', this._startHandler);
        bind(this.scroller, endTransitionEventName, this._transitionEndHandler);
        bind(window, 'touchmove', this._moveHandler);
        bind(window, 'touchend', this._endHandler);
        bind(window, 'touchcancel', this._cancelHandler);

        // 当有step设置的时候防止执行两次end
        this._endCallbackTag = true;
        this._endTimeout = null;
    }

    AlloyTouch.prototype = {
        _getValue: function (obj, defaultValue) {
            return obj === undef ? defaultValue : obj;
        },
        _stop: function (current) {
            this.animationEnd(current);
            cancelAnimationFrame(this.tickID);
        },
        _transitionEnd: function () {
            if (!this._triggerTransitionEnd) return;
            var current = this.scroller[this.property];
            if (current < this.min) {
                this.to(this.min, 600, ease);
                return;
            } else if (current > this.max) {
                this.to(this.max, 600, ease);
                return;
            }

            if (this.step) {
                this.correction();
                if (this._endCallbackTag) {
                    this._endTimeout = setTimeout(this._stop, 400, current);
                    this._endCallbackTag = false;
                }
            } else {
                this._stop(current);
            }
        },
        _cancelAnimation: function () {
            this.scroller.style[transitionDuration] = '0ms';
            this.scroller[this.property] = this.getComputedPosition();
        },
        getComputedPosition: function () {
            var matrix = window.getComputedStyle(this.scroller, null);
            matrix = matrix[transform].split(')')[0].split(', ');
            return this.vertical ? (Number(matrix[13] || matrix[5])) : (Number(matrix[12] || matrix[4]));
        },
        _tick: function () {
            this.change(this.getComputedPosition());
            this.tickID = requestAnimationFrame(this._tick);
        },
        _start: function (evt) {
            cancelAnimationFrame(this.tickID);
            this._tick();

            this._endCallbackTag = true;
            this.isTouchStart = true;
            this._firstTouchMove = true;
            this._preventMove = false;
            this.touchStart(evt, this.scroller[this.property]);
            this._cancelAnimation();
            clearTimeout(this._endTimeout);
            if (this.hasMax && this.hasMin) {
                this.currentPage = Math.round((this.max - this.scroller[this.property]) / this.step);
            }
            this.startTime = new Date().getTime();
            this._startX = this.preX = evt.touches[0].pageX;
            this._startY = this.preY = evt.touches[0].pageY;
            this.start = this.vertical ? this.preY : this.preX;
        },
        _move: function (evt) {
            if (this.isTouchStart) {
                var dx = Math.abs(evt.touches[0].pageX - this._startX);
                var dy = Math.abs(evt.touches[0].pageY - this._startY);
                if (this._firstTouchMove && this.lockDirection) {
                    var dDis = dx - dy;
                    if (dDis > 0 && this.vertical) {
                        this._preventMove = true;
                    } else if (dDis < 0 && !this.vertical) {
                        this._preventMove = true;
                    }
                    this._firstTouchMove = false;
                }
                if (dx < 10 && dy < 10) return;

                if (!this._preventMove) {
                    var f = this.moveFactor;
                    var d = (this.vertical ? evt.touches[0].pageY - this.preY : evt.touches[0].pageX - this.preX) * this.sensitivity;
                    if (this.hasMax && this.scroller[this.property] > this.max && d > 0) {
                        f = this.outFactor;
                    } else if (this.hasMin && this.scroller[this.property] < this.min && d < 0) {
                        f = this.outFactor;
                    }
                    d *= f;
                    this.preX = evt.touches[0].pageX;
                    this.preY = evt.touches[0].pageY;
                    this.scroller[this.property] += d;

                    var timestamp = new Date().getTime();
                    if (timestamp - this.startTime > 300) {
                        this.startTime = timestamp;
                        this.start = this.vertical ? this.preY : this.preX;
                    }
                    this.touchMove(evt, this.scroller[this.property]);
                }

                if (this.preventDefault && !preventDefaultTest(evt.target, this.preventDefaultException)) {
                    evt.preventDefault();
                }
            }
        },
        _end: function (evt) {
            if (this.isTouchStart) {
                var self = this;
                var current = this.scroller[this.property];
                if (this.touchEnd(evt, current) === false) {
                    this._triggerTransitionEnd = false;
                    return;
                }

                this._triggerTransitionEnd = true;

                if (this.hasMax && current > this.max) {
                    this.to(this.max, 600, ease);
                } else if (this.hasMin && current < this.min) {
                    this.to(this.min, 600, ease);
                } else if (this.inertia && !this._preventMove) {
                    var dt = new Date().getTime() - this.startTime;
                    if (dt < 300) {
                        var distance = ((this.vertical ? evt.changedTouches[0].pageY : evt.changedTouches[0].pageX) - this.start) * this.sensitivity;
                        var speed = Math.abs(distance) / dt;
                        var speed2 = this.factor * speed;
                        if (this.hasMaxSpeed && speed2 > this.maxSpeed) {
                            speed2 = this.maxSpeed;
                        }
                        var destination = current + (speed2 * speed2) / (2 * this.deceleration) * (distance < 0 ? -1 : 1);

                        var tRatio = 1;
                        if (destination < this.min) {
                            if (destination < this.min - this.maxRegion) {
                                tRatio = reverseEase((current - this.min + this.springMaxRegion) / (current - destination));
                                destination = this.min - this.springMaxRegion;
                            } else {
                                tRatio = reverseEase((current - this.min + this.springMaxRegion * (this.min - destination) / this.maxRegion) / (current - destination));
                                destination = this.min - this.springMaxRegion * (this.min - destination) / this.maxRegion;
                            }
                        } else if (destination > this.max) {
                            if (destination > this.max + this.maxRegion) {
                                tRatio = reverseEase((this.max + this.springMaxRegion - current) / (destination - current));
                                destination = this.max + this.springMaxRegion;
                            } else {
                                tRatio = reverseEase((this.max + this.springMaxRegion * (destination - this.max) / this.maxRegion - current) / (destination - current));
                                destination = this.max + this.springMaxRegion * (destination - this.max) / this.maxRegion;
                            }
                        }
                        var duration = Math.round(speed / self.deceleration) * tRatio;

                        self.to(Math.round(destination), duration, ease);
                    } else {
                        if (self.step) {
                            self.correction();
                        }
                    }
                } else {
                    if (self.step) {
                        self.correction();
                    }
                }
                if (this.preventDefault && !preventDefaultTest(evt.target, this.preventDefaultException)) {
                    evt.preventDefault();
                }
                this.isTouchStart = false;
            }
        },
        _cancel: function (evt) {
            cancelAnimationFrame(this.tickID);
            if (this.step) {
                this.correction();
            }
            this.touchCancel(evt);
        },
        to: function (value, time, u_ease) {
            var el = this.scroller;
            var property = this.property;

            el.style[transitionDuration] = this._getValue(time, 600) + 'ms';
            el.style[transitionTimingFunction] = u_ease || ease;
            el[property] = value;
        },
        correction: function () {
            var m_str = window.getComputedStyle(this.scroller)[transform];
            var value = this.vertical ? parseInt(m_str.split(',')[13]) : parseInt(m_str.split(',')[12]);
            var rpt = Math.floor(Math.abs(value / this.step));
            var dy = value % this.step;
            var result;
            if (Math.abs(dy) > this.step / 2) {
                result = (value < 0 ? -1 : 1) * (rpt + 1) * this.step;
                if (result > this.max) result = this.max;
                if (result < this.min) result = this.min;
                this.to(result, 400, ease);
            } else {
                result = (value < 0 ? -1 : 1) * rpt * this.step;
                if (result > this.max) result = this.max;
                if (result < this.min) result = this.min;
                this.to(result, 400, ease);
            }
        },
        destroy: function () {
            unbind(this.element, 'touchstart', this._startHandler);
            unbind(this.scroller, endTransitionEventName, this._transitionEndHandler);
            unbind(window, 'touchmove', this._moveHandler);
            unbind(window, 'touchend', this._endHandler);
            unbind(window, 'touchcancel', this._cancelHandler);
        }
    };

    if (typeof module !== 'undefined' && typeof exports === 'object') {
        module.exports = AlloyTouch;
    } else {
        window.AlloyTouch = AlloyTouch;
    }
})();
