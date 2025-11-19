import {A,E,O,Q} from 'https://aeoq.github.io/AEOQ.mjs';

class PointerInteraction { // #private  $data  _user
    #click; #hold = {}; #revert; #callback;
    constructor (targets, actions) {
        Object.assign(this, new O(actions).map(([k, v]) => [`_${k}`, v]));
        PointerInteraction.to.elements(targets).forEach(el => {
            PointerInteraction.#roots.add(el.getRootNode());
            (this._drag || this._drop) && el.classList.add('PI-draggable');
            this._scroll && this.#scrollable(el);
        });
        this.#revert = this._drag?.revert;
    }
    #events = new Proxy(
        Object.defineProperty({}, 'remove', {
            value() {[...new O(this)].forEach(p => removeEventListener(...p))}, 
        }),
        {set: (target, ...p) => addEventListener(...p) || Reflect.set(target, ...p)}
    )
    #scrollable (el) {
        el.classList.add('PI-scrollable');
        el.addEventListener('wheel', ev => (ev.deltaY < 0 && el.scrollLeft != 0 
            || ev.deltaY > 0 && el.scrollLeft != el.scrollWidth - el.clientWidth
            ) && (el.scrollLeft += ev.deltaY > 0 ? 100 : -100) && ev.preventDefault()
        );
        el.addEventListener('scroll', () => E(el).set({'--scrolledX': el.scrollLeft, '--scrolledY': el.scrollTop}));
    }
    execute (ev, target) {
        this.target = target ?? ev.target;
        this.#press(ev);
    }
    #press (ev) {
        if (!this.target || this.target.Q('.PI-target') || this._scroll && ev.pointerType != 'mouse') 
            return this.#reset();
        this.target.classList.add('PI-target');

        this.$press = {
            x: ev.clientX, y: ev.clientY,
            sx: this.target.scrollLeft, sy: this.target.scrollTop, scrollY,
            target: {
                ...E(this.target).getBoundingPageRect(),
                transform: new DOMMatrix(getComputedStyle(this.target).transform),
            }
        };
        this._hold && (this.#hold.timer = this._hold(new Hold(this)).schedule());
        Q(this._drop?.goal, []).forEach(el => el.classList.add('PI-droppable'));

        typeof this._press == 'function' && this._press(this, this.target);

        this.#events.contextmenu = ev => ev.preventDefault();
        this.#events.pointermove = ev => this.#drag(ev);
        this.#events.pointerup = this.#events.pointercancel = ev => this.#lift(ev);
    }
    #drag (ev) {
        ev.preventDefault();
        if (this.target.Q('.PI-target')) return this.#reset();

        this.$drag = {
            ...this.$drag ?? {tx: 0, ty: 0},
            x: ev.clientX, y: ev.clientY, 
            dx: ev.clientX-this.$press.x, dy: ev.clientY-this.$press.y,
        };
        if (Math.hypot(this.$drag.dx, this.$drag.dy) < 5) return;
        this.target.classList.add('PI-dragged');

        this.#hold.timer?.forEach(clearTimeout);
        this._scroll && this.drag.to.scroll(this._scroll === true ? undefined : this._scroll);
        if (this._drop) {
            this.drag.to.translate({x: this._drag?.x, y: this._drag?.y});
            this.drag.to.scrollPage({x: this._drag?.x, y: this._drag?.y});
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
        select: (bullseye, children = PI.target.children) => {
            this.target.Q('.PI-selected')?.classList.remove('PI-selected');
            [...children].find(child => E(child).contains(bullseye))?.classList.add('PI-selected');
        },
        scrollPage: axis => {
            let proportion = this.$drag.y / innerHeight;
            let bottomed = scrollY + innerHeight >= document.body.offsetHeight + 100;
            let amount = proportion < .05 ? -4 : proportion > .95 && !bottomed ? 4 : 0;
            if (!amount)
                return PointerInteraction.loop &&= cancelAnimationFrame(PointerInteraction.loop);
            let loop = (() => {
                scrollBy(0, amount);
                this.drag.to.translate(axis);
                PointerInteraction.loop = requestAnimationFrame(loop);
            });
            PointerInteraction.loop || loop();
        },
        findGoal: () => {
            let below = document.elementFromPoint(this.$drag.x, this.$drag.y);
            (below && below != this._drop.goal && !below.matches(this._drop.goal) || below?.Q('.PI-goal')) && (below = null);
            this.target.classList.toggle('PI-reached', below ? true : false);
            if (below == this.goal) return; 
            this.goal?.classList.remove('PI-goal');
            (this.goal = below)?.classList.add('PI-goal');
        }
    }}
    #lift (ev) {
        this._scroll && ev.pointerType == 'mouse' && Math.hypot(this.$drag?.dx, this.$drag?.dy) >= 5 && ev.stopPropagation();
        if (!this.target) return this.#reset();
        this.goal && (this.$lift = {transform: new DOMMatrix(getComputedStyle(this.goal).transform)});
        this._click && !this.target.matches('.PI-dragged') && this.lift.to.click();

        typeof this._lift == 'function' && this._lift(this, this.target, this.goal);
        this.#revert && !PointerInteraction.swapping && this.lift.to.revert();
        this.#reset();
    }
    lift = {to: {
        click: () => {
            this.#click ??= this._click(new Click(this));
            this.target.clicked = new Date() - this.target.lastClicked <= 500 ? this.target.clicked + 1 : 1;
            this.target.lastClicked = new Date();
            this.#click.fire(this.target.clicked);
        },
        transfer: cloned => {
            if (!this.goal || this.goal == this.target.parentElement) return;
            let appended = this.goal.appendChild(cloned ?? this.target);
            appended.classList.remove(...PointerInteraction.classes);
            appended.style.transform = this.$press.target.transform;
        },
        clone: () => this.lift.to.transfer(this.target.cloneNode(true)),
        swap: () => {
            if (!this.goal) return;
            PointerInteraction.swapping = true;
            this.target.classList.add('PI-animate');
            this.goal.classList.add('PI-animate');
            let {x, y} = E(this.goal).getBoundingPageRect();
            this.#translate(x - this.$press.target.x, y - this.$press.target.y);
            this.#translate(this.$press.target.x - x, this.$press.target.y - y, this.goal);
            this.#callback = this.#commitSwap;
        },
        revert: () => {
            Math.hypot(this.$drag?.dx, this.$drag?.dy) >= 1 && this.target.classList.add('PI-animate');
            this.target.style.transform = this.$press.target.transform;
        }
    }}
    #reset () {
        PointerInteraction.loop = cancelAnimationFrame(PointerInteraction.loop);
        this.#hold.timer?.forEach(clearTimeout);
        let [target, goal] = [this.target, this.goal];
        this.target = this.goal = null;
        this.#events.remove();
        this.$drag = null;
        target?.classList.remove(...PointerInteraction.classes);
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
            e: this.$press.target.transform.e + this.$drag.tx,
            f: this.$press.target.transform.f + this.$drag.ty, 
        });
    }
    #commitSwap = (target, goal) => {
        let place = E('span');
        target.before(place);
        goal.before(target);
        place.replaceWith(goal);
        target.style.transform = this.$press.target.transform;
        goal.style.transform = this.$lift.transform; 
        PointerInteraction.swapping = false;
    }
    static #roots = new Set();
    static #css = place => place.Q('#PI') || place.append(E('style#PI', `
        .PI-draggable {
            touch-action: none; user-select: none;
            a,img {-webkit-user-drag: none;}
        }
        .PI-droppable {z-index:0;}
        .PI-dragged,.PI-scrollable:has(.PI-dragged),
        .PI-animate,.PI-scrollable:has(.PI-animate) {
            z-index:1; position:relative;
        }
        .PI-dragged {pointer-events: none;}
        .PI-scrollable {
            overflow:scroll; scrollbar-width:none;
            contain:layout;
            
            &:has(.PI-target,.PI-animate) {
                overflow:visible;
                transform:translate(calc(var(--scrolledX,0)*-1px),calc(var(--scrolledY,0)*-1px));
            }
        }
        .PI-animate {
            transition:transform .5s;
            
            :has(&) {pointer-events:none;}
        }
    `));
    static to = {
        elements: els => [els].flat().flatMap(el => typeof el == 'string' ? Q(el) : el).filter(el => el)
    }
    static events = settings => {
        settings = new O(settings).map(([targets, actions]) => [targets, new PointerInteraction(targets, actions)]);
        PointerInteraction.#roots.forEach(root => {
            PointerInteraction.#css(root instanceof ShadowRoot ? root : document.head);
            root.addEventListener('pointerdown', ev => PointerInteraction.#pointerdown(ev, settings))
        });
    }
    static #pointerdown = (ev, settings) => {
        let target;
        let pair = settings.find(([targets]) => typeof targets == 'string' ? 
            ev.target.matches(targets) : 
            [targets].flat().includes(ev.target)
        );
        pair ??= settings.find(([targets]) => typeof targets == 'string' ? 
            target = ev.target.closest(targets) : 
            [targets].flat().includes(target = ev.target.assignedSlot)
        );
        if (!pair) return;
        pair[1].execute(ev, target);
    }
    static classes = ['PI-droppable', 'PI-target', 'PI-dragged', 'PI-reached']
}
class HoldClick {
    constructor(PI) {this.PI = PI;}
    actions = [];
    for = param => this.actions.push([param]) && this;
    to = action => this.actions.at(-1).push(action) && this;
    chain = func => (func && func(this), this);
}
class Hold extends HoldClick {
    constructor(PI) {super(PI);}
    schedule = () => this.actions.map(([s, action]) => setTimeout(() => action(this.PI, this.PI.target), s*1000));
}
class Click extends HoldClick {
    #timers = [];
    constructor(PI) {super(PI);}
    abort = () => this.actions.at(-1).push(true) && this;
    fire = () => {
        let target = this.PI.target;
        this.#timers.forEach(([times, timer]) => times < target.clicked && clearTimeout(timer));
        this.actions.forEach(([times, action, abort]) => target.clicked == times && 
            this.#timers.push([target.clicked, setTimeout(() => action(this.PI, target), abort ? 500 : 0)]));
    }
}
export default PointerInteraction
