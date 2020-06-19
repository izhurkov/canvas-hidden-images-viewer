class CanvasHiddenImagesViewer {
    constructor(options) {
        this.options = options;
        this.name = 'CanvasHiddenImagesViewer';
        this.canvas = document.createElement('canvas');
        this.canvas.style = `cursor: ${options.cursorVisible || 'default'}`;
        this.ctx = this.canvas.getContext('2d');

        if (options.root) {
            options.root.append(this.canvas);
        } else {
            console.error(`${this.name}: root not specified`);
        }
        if (!options.backgroundImage) {
            console.error(`${this.name}: backgroundImage not specified`);
        }
        this.position = {x: 0, y: 0};

        this.backgroundImage = new Image;
        this.backgroundImageLoaded = false;
        this.hiddenImages = [];
        this.hiddenCount = 0;
        this.loadedCount = 0;

        this.radius = options.radius || 100;

        this.drawIntervalId = false;

        this.mask = {
            radius: 0,
            to: this.options.radius || 100,
            easy: this.options.easy || 'easeInOutCubic',
            duration: this.options.duration || 0.5
        }

        let scope = this;
        this.canvas.addEventListener('mousemove', function(event) {
            scope.position = scope.getPosition(event.offsetX, event.offsetY);
        })
        this.canvas.addEventListener('mouseout', function(event) {
            scope.radiusTo(scope.mask, {from: scope.mask.radius, to: 0, duration: scope.mask.duration, easy: scope.mask.easy}, function() {
                scope.endDraw();
            });
            scope.position = scope.getPosition(event.offsetX, event.offsetY);
        })
        this.canvas.addEventListener('mouseover', function(event) {
            scope.startDraw();
            scope.radiusTo(scope.mask, {from: scope.mask.radius, to: scope.mask.to, duration: scope.mask.duration , easy: scope.mask.easy});
            scope.position = scope.getPosition(event.offsetX, event.offsetY);
        })

        this.redrawInterval = 1000 / (options.fps || 30);

        this.loadImages(options);
    }

    radiusTo(mask, options, callback) {
        if (this.timeId) {
            clearInterval(this.timeId);
            this.timeId = false;
        }
        if (!options) { return; }
        if (typeof(options.duration) === 'number' && options.duration === 0) {
            mask.radius = (options.to || 1);
            if (callback) {
                callback();
            }
            return;
        }
        let easyFunction = ( options.easy ? this[options.easy] : this['easeInOutCubic']);
        if (typeof(easyFunction) === 'undefined') {
            console.error(`${this.name}: easy is wrong`);
            return;
        }
        let scope = this;
        let ts = performance.now();
        let from = mask.radius;
        this.timeId = setInterval( function() {
            let tc = performance.now();
            let delta = tc - ts;
            if (delta > (options.duration * 1000 || 1000) ) {
                mask.radius = (options.to || 1);
                if (callback) {
                    callback();
                }
                clearInterval(scope.timeId);
                scope.timeId = false;
                return;
            }
            mask.radius = Math.max( 0, easyFunction(delta, from, (options.to || 1), (options.duration * 1000 || 1000) ));
        }, this.redrawInterval );
    }

    linear(t, b, c, d) {
        return b + (c - b) * t / d;
    }
    easeInOutCubic(t, b, c, d) {
        t /= d/2;
        if (t < 1) return (c-b)/2*t*t*t + b;
        t -= 2;
        return (c-b)/2*(t*t*t + 2) + b;
    };
    easeOutElastic(t, b, c, d) {
        let s = 1.70158;
        let p = 0;
        let a = c;
        if (t === 0) return b;
        if ((t/=d) === 1) return c;
        if (!p) p = d * 0.3;
        if (a < Math.abs(c)) {
            a=c;
            s=p/4;
        } else {
            s = p / ( 2 * Math.PI ) * Math.asin(c / a);
        }
        return a * Math.pow(2, -10*t) * Math.sin( (t*d-s) * (2*Math.PI)/p ) + c;
    };
    easeInQuad(t, b, c, d) {
        return (c-b)*(t/=d)*t + b;
        };
    easeOutQuad(t, b, c, d) {
        return -(c-b)*(t/=d)*(t-2) + b;
        };
    easeInOutQuad(t, b, c, d) {
        if ((t/=d/2) < 1) return (c-b)/2*t*t + b;
        return -(c-b)/2 * ((--t)*(t-2) - 1) + b;
    };

    imagesLoaded() {
        if ( this.backgroundImageLoaded ) {
            this.canvas.width = this.backgroundImage.width;
            this.canvas.height = this.backgroundImage.height;
            this.startDraw();
        }
    }

    startDraw() {
        let scope = this;
        if (!this.drawIntervalId) {
        this.drawIntervalId = setInterval(function() {
        scope.draw();
        }, this.redrawInterval);
        }
    }

    getPosition(x, y) {
        let boundRect = this.canvas.getBoundingClientRect();
        return {x: x * this.canvas.width / boundRect.width, y: y * this.canvas.height / boundRect.height};
    }

    endDraw() {
        clearInterval(this.drawIntervalId);
        this.drawIntervalId = false;
    }

    onMouseOver(event) {
        this.position = { x: event.offsetX, y: event.offsetY };
        this.draw();
    }

    loadImages(options) {
        let scope = this;
            if (options.backgroundImage) {
                this.backgroundImage.src = options.backgroundImage;
                this.backgroundImage.addEventListener('load', function() {
                    scope.backgroundImageLoaded = true;
                    scope.imagesLoaded();
                });
                this.backgroundImage.addEventListener('error', function() {
                    console.error(`${scope.name}: backgroundImage load error`);
                })
                this.getPosition();
            }

            this.hiddenCount = options.hiddenImages.length;
            this.loadedCount = 0;
            for (let i in options.hiddenImages ) {
            let hiddenImage = options.hiddenImages[i];
            let image = new Image;
            image.src = hiddenImage.src;
            hiddenImage.image = image;
            image.addEventListener('load', function() {
                scope.hiddenImages.push(hiddenImage);
                scope.loadedCount++;
                scope.imagesLoaded();
            });
            image.addEventListener('error', function() {
                scope.hiddenCount--;
                scope.imagesLoaded();
                console.error(`${scope.name}: image number ${i} load error`);
            })
        }
    }

    draw() {
        let bg = this.backgroundImage;
        let hidden = this.hiddenImages;
        let canvas = this.canvas;
        let ctx = this.ctx;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

        for (let i in hidden) {
            let h = hidden[i];
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.arc(this.position.x, this.position.y, this.mask.radius * this.canvas.width / this.canvas.offsetWidth, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(h.image, h.left || 0, h.top || 0, h.width || h.image.width, h.height || h.image.height);
            ctx.restore();
        }
    }
}