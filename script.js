import {A,E,O,Q} from '../AEOQ.mjs';

class PointerInteraction { // #private  $data  _user
    #click; #hold = {}; #revert; #callback;
    constructor (targets, actions) {
        Object.assign(this, new O(actions).map(([k, v]) => [`_${k}`, v]));
        PointerInteraction.to.elements(targets).forEach(el => {
            if (!this._scroll) return el.parentElement.style.touchAction = 'none';
            el.classList.add('PI-scroll');
            el.addEventListener('scroll', () => E(el).set({'--scrolledX': el.scrollLeft, '--scrolledY': el.scrollTop}));
        });
        this.#revert = this._drag?.revert;
    }
    #events = new Proxy(
        Object.defineProperty({}, 'remove', {value() {[...new O(this)].forEach(p => removeEventListener(...p))}, enumerable: false}),
        {set: (target, ...p) => addEventListener(...p) ?? Reflect.set(target, ...p)} //window
    )
    execute (ev, target) {
        this.target = target ?? ev.target;
        this.#press(ev);
    }
    #press (ev) {
        if (!this.target || this.target.Q('.PI-target')) return this.#reset();
        this.target.classList.add('PI-target');

        this.$press = {
            x: ev.x, y: ev.y,
            sx: this.target.scrollLeft, sy: this.target.scrollTop, scrollY,
            initial: new DOMMatrix(getComputedStyle(this.target).transform),
            target: PointerInteraction.getBoundingPageRect(this.target)
        };

        this._click && this.press.to.count() && (this.#click ??= this._click(new Click(this))) && this.#click.fire(this.target.clicked);
        this._hold && (this.#hold.timer = this._hold(new Hold(this)).schedule());

        typeof this._press == 'function' && this._press(this, this.target);

        this.#events.pointermove = ev => this.#drag(ev);
        this.#events.pointerup = this.#events.pointercancel = () => this.#lift();
    }
    press = {to: {
        count: () => [this.target.clicked, this.target.lastClicked] = 
            [new Date() - this.target.lastClicked <= 500 ? this.target.clicked + 1 : 1, new Date()]
    }}
    #drag (ev) {
        ev.preventDefault();
        if (this.target.Q('.PI-target')) return this.#reset();
        
        this.$drag = {
            ...this.$drag ?? {tx: 0, ty: 0},
            x: ev.x, y: ev.y, dx: ev.x-this.$press.x, dy: ev.y-this.$press.y,
        };
        if (Math.hypot(this.$drag.dx, this.$drag.dy) < 5) return;

        this.#hold.timer?.forEach(clearTimeout);
        this._scroll && this.drag.to.scroll(this._scroll === true ? undefined : this._scroll);
        if (this._drop) {
            this.drag.to.translate({x: this._drag?.x, y: this._drag?.y});
            this.drag.to.scrollPage();
            this.drag.to.findGoal();
        }
        typeof this._drag == 'function' && this._drag(this, this.target, this.goal);
    }
    drag = {to: {
        scroll: (axis = {x: true, y: true}) => this.target.scrollTo(
            this.$press.sx - (axis.x ? this.$drag.dx : 0), 
            this.$press.sy - (axis.y ? this.$drag.dy : 0)
        ),
        translate: (axis = {x: true, y: true}) => this.#translate(...['x','y'].map(a => {
            let limit = new O({min: -Infinity, max: Infinity}).map(([m, v]) => 
                [m, typeof axis[a]?.[m] == 'function' ? axis[a][m](this, this.target, this.goal) : axis[a]?.[m] ?? v]);
            return Math.max(limit.min, Math.min(axis[a] === false ? 0 : this.$drag[`d${a}`], limit.max));
        })),
        scrollPage: () => {
            let [proportion, bottomed] = [this.$drag.y / innerHeight, scrollY + innerHeight >= document.body.offsetHeight + 100];
            proportion < .05 ? scrollBy(0, -4) : 
            proportion > .95 && !bottomed ? scrollBy(0, 4) : null;
        },
        findGoal: () => {
            let goal = PointerInteraction.to.elements(this._drop.goal) //live, includes cloned
                .find(el => el != this.target && PointerInteraction.containsPointer(el, this.$drag.x, this.$drag.y));
            goal?.Q('.PI-goal') && (goal = null);
            if (goal == this.goal) return; 
            this.goal?.classList.remove('PI-goal');
            this.goal = goal;
            goal?.classList.add('PI-goal');
        }
    }}
    #lift () {
        if (this.goal) {
            this.$lift = {initial: new DOMMatrix(getComputedStyle(this.goal).transform)};
            this.goal.style.touchAction = 'none';
        }
        typeof this._lift == 'function' && this._lift(this, this.target, this.goal);
        this.#revert && !PointerInteraction.swapping && this.lift.to.revert();
        this.#reset();
    }
    lift = {to: {
        transfer: cloned => {
            if (!this.goal || this.goal == this.target.parentElement) return;
            let appended = this.goal.appendChild(cloned ?? this.target);
            appended.classList.remove('PI-target');
            appended.style.transform = this.$press.initial;
        },
        clone: () => this.lift.to.transfer(this.target.cloneNode(true)),
        swap: () => {
            if (!this.goal) return;
            PointerInteraction.swapping = true;
            this.target.classList.add('PI-animate');
            this.goal.classList.add('PI-animate');
            let {x, y} = PointerInteraction.getBoundingPageRect(this.goal);
            this.#translate(x - this.$press.target.x, y - this.$press.target.y);
            this.#translate(this.$press.target.x - x, this.$press.target.y - y, this.goal);
            this.#callback = this.#commitSwap;
        },
        revert: () => {
            this.target.classList.add('PI-animate');
            this.target.style.transform = this.$press.initial;
        }
    }}
    #reset () {
        this.#hold.timer?.forEach(clearTimeout);
        let [target, goal] = [this.target, this.goal];
        this.target = this.goal = null;
        this.#events.remove();
        target?.classList.remove('PI-target');
        goal?.classList.remove('PI-goal');
        Q('.PI-animate') && setTimeout(() => {
            this.#callback?.(target, goal);
            target?.classList.remove('PI-animate');
            goal?.classList.remove('PI-animate');
            this.#callback = null;
        }, 500);
    }
    #translate (x, y, which = this.target) {
        this.#revert = true;
        [this.$drag.tx, this.$drag.ty] = [x, y + scrollY - this.$press.scrollY];
        which.style.transform = Object.assign(new DOMMatrix(getComputedStyle(which).transform), {
            e: this.$press.initial.e + this.$drag.tx,
            f: this.$press.initial.f + this.$drag.ty, 
        });
    }
    #commitSwap = (target, goal) => {
        let place = E('span');
        target.before(place);
        goal.before(target);
        place.replaceWith(goal);
        target.style.transform = this.$press.initial;
        goal.style.transform = this.$lift.initial; 
        PointerInteraction.swapping = false;
    }
    static #css = place => place.Q('#PI') || place.append(E('style', {id: 'PI'}, `
        .PI-target {
            z-index:99; position:relative;
            &,* {pointer-events:none;}
        }
        :has(.PI-target) {
            user-select:none;
        }
        .PI-scroll {
            overflow:scroll;
            scrollbar-width:none;
            touch-action:none;
            
            &:has(.PI-target,.PI-animate) {
                overflow:visible;
                transform:translate(calc(var(--scrolledX,0)*-1px),calc(var(--scrolledY,0)*-1px));
            }
        }
        .PI-animate {
            z-index:98; position:relative;
            transition:transform .5s;
            :has(&) {pointer-events:none;}
        }
    `));
    static to = {
        elements: els => [els].flat().flatMap(el => typeof el == 'string' ? Q(el) : el).filter(el => el)
    }
    static getBoundingPageRect = el => (({x, y}) => ({
        x: x + scrollX,
        y: y + scrollY,
    }))(el.getBoundingClientRect())
    static containsPointer = (el, px, py) => el && (({x, y, width, height}) => 
        px > x && py > y && px < x+width && py < y+height
    )(el.getBoundingClientRect())

    static events = settings => {
        settings = new O(settings).map(([targets, actions]) => [targets, new PointerInteraction(targets, actions)]);
        addEventListener('pointerdown', ev => {
            let target, actions = settings.find(([targets]) => typeof targets == 'string' ? 
                ev.target.matches(targets) : [targets].flat().includes(ev.target)
            );
            actions ??= settings.find(([targets]) => typeof targets == 'string' && (target = ev.target.closest(targets)));
            if (!actions) return;
            PointerInteraction.#css(ev.target.getRootNode() instanceof ShadowRoot ? ev.target.getRootNode() : document.head);
            actions[1].execute(ev, target);
        });
    }
}
class HoldClick {
    constructor(PI) {this.PI = PI;}
    actions = [];
    for = param => this.actions.push([param]) && this;
    to = action => this.actions.at(-1).push(action) && this;
}
class Hold extends HoldClick {
    constructor(PI) {super(PI);}
    schedule = () => this.actions.map(([s, action]) => setTimeout(() => action(this.PI, this.PI.target), s*1000));
}
class Click extends HoldClick {
    #timer = new O();
    constructor(PI) {super(PI);}
    abort = () => this.actions.at(-1).push(true) && this;
    fire = () => {
        let target = this.PI.target;
        this.#timer.each(([times, timer]) => times < target.clicked && clearTimeout(timer));
        let [, action, abort] = this.actions.find(([times]) => target.clicked == times) ?? [];
        action && this.#timer.set(target.clicked, setTimeout(() => action(this.PI, target), abort ? 500 : 0));
    }
}
export {PointerInteraction}
