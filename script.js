import {A,E,O,Q} from '../AEOQ.mjs';

class PointerInteraction { // #private  $data  _user
    #hold = {}; #revert = false; #callback;
    constructor (targets, custom) {
        Object.assign(this, new O(custom).map(([k, v]) => [`_${k}`, v]));
        PointerInteraction.to.elements(targets).forEach(el => {
            if (!this._scroll) return el.parentElement.style.touchAction = 'none';
            el.classList.add('pointer-scroll');
            el.addEventListener('scroll', () => E(el).set({'--scrolledX': el.scrollLeft, '--scrolledY': el.scrollTop}));
        }); 
        addEventListener('pointerdown', ev => this.#press(ev, [targets].flat()));
        Q('#pointer-interaction') || Q('head').append(E('style', {id: 'pointer-interaction'}, this.#css));
    }
    #events = new Proxy(
        Object.defineProperty({}, 'remove', {value() {[...new O(this)].forEach(p => removeEventListener(...p))}, enumerable: false}),
        {set: (target, ...p) => addEventListener(...p) ?? Reflect.set(target, ...p)} //window
    )
    #press (ev, targets) {
        this.target = targets.some(t => typeof t == 'string' ? ev.target.matches(t) : ev.target == t) ?
            ev.target : typeof targets[0] == 'string' ? ev.target.closest(targets[0]) : null;
        if (!this.target) return;
        this.target.classList.add('pointer-target');

        this.$press = {
            x: ev.x, y: ev.y,
            sx: this.target.scrollLeft, sy: this.target.scrollTop, scrollY,
            userTransform: new DOMMatrix(getComputedStyle(this.target).transform),
            target: PointerInteraction.getBoundingPageRect(this.target)
        };

        this._dblclick && (new Date() - this.target.lastPressed <= 500) && this._dblclick(new DoubleClick(this)).fire();
        this.target.lastPressed = new Date();
        this._hold && (this.#hold.timer = this._hold(new Hold(this)).schedule());

        this._press?.(this, this.target);

        this.#events.pointermove = ev => this.#drag(ev);
        this.#events.pointerup = this.#events.pointercancel = () => this.#lift();
    }
    #drag (ev) {
        ev.preventDefault();
        if (this.target.Q('.pointer-target')) return this.#reset();
        
        this.$drag = {x: ev.x, y: ev.y, dx: ev.x-this.$press.x, dy: ev.y-this.$press.y};
        if (Math.hypot(this.$drag.dx, this.$drag.dy) < 5) return;

        clearTimeout(this.#hold.timer);
        this._scroll && this.drag.to.scroll(this._scroll === true ? undefined : this._scroll);
        this._drop && [this.#translate(), this.drag.to.scrollPage(), this.drag.to.findGoal()];
        this._drag?.(this, this.target, this.goal);
    }
    drag = {to: {
        scroll: (axis = {x: true, y: true}) => this.target.scrollTo(
            this.$press.sx - (axis.x ? this.$drag.dx : 0), 
            this.$press.sy - (axis.y ? this.$drag.dy : 0)
        ),
        translate: (axis = {x: true, y: true}) => this.#translate(new O(['x','y'].map(a => {
            let d = axis[a] === false ? 0 : this.$drag[`d${a}`];
            d && ['min', 'max'].forEach(m => typeof axis[a][m] == 'function' && (axis[a][m] = axis[a][m](this.target)));
            return [a, Math.max(axis[a].min ?? -Infinity, Math.min(d, axis[a].max ?? Infinity))];
        }))),
        scrollPage: () => {
            let [proportion, bottomed] = [this.$drag.y / innerHeight, scrollY + innerHeight >= document.body.offsetHeight + 100];
            proportion < .05 ? scrollBy(0, -4) : 
            proportion > .95 && !bottomed ? scrollBy(0, 4) : null;
        },
        findGoal: () => {
            let goal = PointerInteraction.to.elements(this._drop.goal) //live, includes cloned
                .find(el => el != this.target && PointerInteraction.containsPointer(el, this.$drag.x, this.$drag.y));
            if (goal == this.goal) return; 
            this.goal?.classList.remove('pointer-goal');
            this.goal = goal;
            goal?.classList.add('pointer-goal');
        }
    }}
    #lift () {
        this.goal && (this.$lift = {userTransform: new DOMMatrix(getComputedStyle(this.goal).transform)});
        this._lift?.(this, this.target, this.goal);
        this.#revert && this.lift.to.revert();
        this.#reset();
    }
    lift = {to: {
        transfer: cloned => {
            if (!this.goal || this.goal == this.target.parentElement) return;
            let appended = this.goal.appendChild(cloned ?? this.target);
            appended.classList.remove('pointer-target');
            appended.style.transform = this.$press.userTransform;
        },
        clone: () => this.lift.to.transfer(this.target.cloneNode(true)),
        swap: () => {
            if (!this.goal) return;
            this.#revert = false;
            this.target.classList.add('pointer-animate');
            this.goal.classList.add('pointer-animate');
            let {x, y} = PointerInteraction.getBoundingPageRect(this.goal);
            this.#translate({x: x - this.$press.target.x, y: y - this.$press.target.y});
            this.#translate({x: this.$press.target.x - x, y: this.$press.target.y - y}, this.goal);
            this.#callback = this.#commitSwap;
        },
        revert: () => {
            this.target.classList.add('pointer-animate');
            this.target.style.transform = this.$press.userTransform;
        }
    }}
    #reset () {
        clearTimeout(this.#hold.timer);
        let [target, goal] = [this.target, this.goal];
        this.target = this.goal = null;
        this.#events.remove();
        target.classList.remove('pointer-target');
        goal?.classList.remove('pointer-goal');
        Q('.pointer-animate') && setTimeout(() => {
            this.#callback?.(target, goal);
            target.classList.remove('pointer-animate');
            goal?.classList.remove('pointer-animate');
            this.#callback = null;
        }, 500);
    }
    #translate (d, which) {
        this.#revert = !d;
        which ??= this.target;
        let matrix = new DOMMatrix(getComputedStyle(which).transform);
        matrix.e = d?.x ?? this.$drag.dx;
        matrix.f = (d?.y ?? this.$drag.dy) + scrollY - this.$press.scrollY; 
        which.style.transform = matrix;
    }
    #commitSwap = (target, goal) => {
        let place = E('span');
        target.before(place);
        goal.before(target);
        place.replaceWith(goal);
        target.style.transform = this.$press.userTransform;
        goal.style.transform = this.$lift.userTransform; 
    }
    #css = `
        .pointer-goal,.pointer-animate {
            z-index:98;
        }
        .pointer-target {
            z-index:99;
            &,* {pointer-events:none;}
        }
        :has(.pointer-target) {
            user-select:none;
        }
        .pointer-scroll {
            overflow:scroll;
            scrollbar-width:none;
            touch-action:none;
            
            &:has(.pointer-target,.pointer-animate) {
                width:min-content;
                overflow:visible;
                transform:translate(calc(var(--scrolledX,0)*-1px),calc(var(--scrolledY,0)*-1px));
            }
        }
        .pointer-animate {
            transition:transform .5s;
            :has(&) {pointer-events:none;}
        }
    `;
    static to = {
        elements: els => [els].flat().flatMap(el => typeof el == 'string' ? Q(el) : el)
    }
    static getBoundingPageRect = el => (({x, y}) => ({
        x: x + scrollX,
        y: y + scrollY,
    }))(el.getBoundingClientRect())
    static containsPointer = (el, moveX, moveY) => el && (({x, y, width, height}) => 
        moveX > x && moveY > y && moveX < x+width && moveY < y+height
    )(el.getBoundingClientRect())
}
class Hold {
    constructor(PI) {
        this.PI = PI;
        this.for = ms => (this.ms = ms) && this;
        this.to = action => (this.action = action) && this;
    }
    schedule = () => setTimeout(() => this.action?.(this.PI, this.PI.target), this.ms);
}
class DoubleClick {
    constructor(PI) {
        this.PI = PI;
        this.to = action => (this.action = action) && this;
    }
    fire = () => this.action?.(this.PI, this.PI.target) 
}
export {PointerInteraction}