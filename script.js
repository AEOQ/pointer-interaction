import {A,E,O,Q} from 'https://aeoq.github.io/AEOQ.mjs';

class PointerInteraction { // #private  $data  _user
    #click; #hold = {}; #drop = {}; #revert; #callback;
    constructor (targets, actions) {
        Object.assign(this, new O(actions).map(([k, v]) => [`_${k}`, v]));
        PointerInteraction.to.elements(targets).forEach(el => {
            PointerInteraction.#roots.add(el.getRootNode());
            (this._drag || this._drop) && el.classList.add('PI-draggable');
            this._scroll && this.#setup.scrollable(el);
        });
        this.#revert = this._drag?.revert;
    }
    #events = new Proxy(
        Object.defineProperty({}, 'remove', {
            value() {[...new O(this)].forEach(p => removeEventListener(...p))}, 
        }),
        {set: (target, ...p) => addEventListener(...p) || Reflect.set(target, ...p)}
    )
    #setup = {
        scrollable (el) {
            el.classList.add('PI-scrollable');
            el.addEventListener('wheel', ev => 
                (ev.deltaY < 0 && el.scrollLeft != 0 || ev.deltaY > 0 && el.scrollLeft != el.scrollWidth - el.clientWidth) 
                && (el.scrollLeft += ev.deltaY > 0 ? 100 : -100) && ev.preventDefault()
            );
            el.addEventListener('scroll', () => E(el).set({'--scrolledX': el.scrollLeft, '--scrolledY': el.scrollTop}));
        },
        droppable: el => {
            this.#drop.onto = typeof el == 'string' ? Q(el, []) : el;
            this.#drop.onto.forEach(el => el.classList.add('PI-droppable'));
        }
    }
    #snapshot = which => ({
        [which]: {
            transform: new DOMMatrix(getComputedStyle(this[which]).transform),
            ...which == 'target' ? E(this.target).getBoundingPageRect() : {},
            ...which == 'target' ? {sx: this.target.scrollLeft, sy: this.target.scrollTop} : {},
        }
    })
    execute (ev, target) {
        this.target = target ?? ev.target;
        this.#press(ev);
    }
    #press (ev) {
        if (!this.target || this.target.Q('.PI-target') || this._scroll && ev.pointerType != 'mouse') 
            return this.#reset();
        this.target.classList.add('PI-target');

        this.$press = {
            x: ev.clientX, y: ev.clientY, scrollY: window.scrollY,
            snapshot: this.#snapshot('target')
        };
        this._hold && (this.#hold.timer = this._hold(new Hold(this)).schedule());
        this._drop?.onto && this.#setup.droppable(this._drop.onto);

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
            dx: ev.clientX - this.$press.x, dy: ev.clientY - this.$press.y,
        };
        if (Math.hypot(this.$drag.dx, this.$drag.dy) < 5) return;
        this.target.classList.add('PI-dragged');

        this.#hold.timer?.forEach(clearTimeout);
        this._scroll && this.drag.to.scroll(this._scroll === true ? undefined : this._scroll);
        if (this._drop) {
            this.drag.to.translate({x: this._drag?.x, y: this._drag?.y});
            this.drag.to.scrollPage({x: this._drag?.x, y: this._drag?.y});
            this.drag.to.findOnto();
        }
        typeof this._drag == 'function' && this._drag(this, this.target, this.onto);
    }
    drag = {to: {
        scroll: (axis = {x: true, y: true}) => this.target.scrollTo(
            this.$press.snapshot.target.sx - (axis.x ? this.$drag.dx : 0), 
            this.$press.snapshot.target.sy - (axis.y ? this.$drag.dy : 0)
        ),
        select: bullseye => {
            this.target.Q('.PI-selected')?.classList.remove('PI-selected');
            this._drag.bullseye ??= bullseye;
            return {from: children => {
                this._drag.from ??= [...children ?? this.target.children];
                this.onto = this._drag.from.find(child => E(child).contains(bullseye));
                this.onto?.classList.add('PI-selected');
            }};
        },
        translate: (axis = {x: true, y: true}) => this.#translate(...['x','y'].map(a => {
            let limit = new O({min: -Infinity, max: Infinity}).map(([m, v]) => 
                [m, typeof axis[a]?.[m] == 'function' ? axis[a][m](this, this.target, this.onto) : axis[a]?.[m] ?? v]);
            return Math.max(limit.min, Math.min(axis[a] === false ? 0 : this.$drag[`d${a}`], limit.max));
        })),
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
        findOnto: () => {
            let below = document.elementFromPoint(this.$drag.x, this.$drag.y);
            if (!below) return;
            below = below.shadowRoot?.elementFromPoint(this.$drag.x, this.$drag.y) ?? below;
            !this.#drop.onto.includes(below) && (below = null);
            this.target.classList.toggle('PI-reached', below ? true : false);
            if (below == this.onto) return; 
            this.onto?.classList.remove('PI-receiving');
            (this.onto = below)?.classList.add('PI-receiving');
        }
    }}
    #lift (ev) {
        this._scroll && ev.pointerType == 'mouse' && Math.hypot(this.$drag?.dx, this.$drag?.dy) >= 5 && ev.stopPropagation();
        if (!this.target) return this.#reset();
        this.onto && (this.$lift = {snapshot: this.#snapshot('onto')});
        this._click && !this.target.matches('.PI-dragged') && this.lift.to.click();

        typeof this._lift == 'function' && this._lift(this, this.target, this.onto);
        this.#revert && !PointerInteraction.swapping && this.lift.to.revert();
        this.#reset();
    }
    lift = {to: {
        click: () => {
            this.#click ??= this._click(new Click(this));
            this.target.clicked = new Date() - this.target.lastClicked <= 350 ? this.target.clicked + 1 : 1;
            this.target.lastClicked = new Date();
            this.#click.fire(this.target.clicked);
        },
        transfer: cloned => {
            if (!this.onto || this.onto == this.target.parentElement) return;
            let appended = this.onto.appendChild(cloned ?? this.target);
            appended.classList.remove(...PointerInteraction.classes.target);
            appended.style.transform = this.$press.snapshot.target.transform;
        },
        clone: () => this.lift.to.transfer(this.target.cloneNode(true)),
        swap: () => {
            if (!this.onto) return;
            PointerInteraction.swapping = true;
            this.target.classList.add('PI-animate');
            this.onto.classList.add('PI-animate');
            let {x, y} = E(this.onto).getBoundingPageRect();
            this.#translate(x - this.$press.snapshot.target.x, y - this.$press.snapshot.target.y);
            this.#translate(this.$press.snapshot.target.x - x, this.$press.snapshot.target.y - y, this.onto);
            this.#callback = this.#commitSwap;
        },
        revert: () => {
            Math.hypot(this.$drag?.dx, this.$drag?.dy) >= 1 && this.target.classList.add('PI-animate');
            this.#revertTransform([this.target, this.$press.snapshot.target]);
        }
    }}
    #reset () {
        PointerInteraction.loop = cancelAnimationFrame(PointerInteraction.loop);
        this.#hold.timer?.forEach(clearTimeout);
        let {target, onto} = this;
        this.target = this.onto = null;
        this.#events.remove();
        this.$drag = null;
        target?.classList.remove(...PointerInteraction.classes.target);
        onto?.forEach(el => el.classList.remove(...PointerInteraction.classes.onto));
        target.matches('.PI-animate') && setTimeout(() => {
            this.#callback?.(target, onto);
            target?.classList.remove('PI-animate');
            onto?.classList.remove('PI-animate');
            this.#callback = null;
        }, 500);
    }
    #translate (x, y, which = this.target) {
        this.#revert = true;
        [this.$drag.tx, this.$drag.ty] = [x, y + scrollY - this.$press.scrollY];
        which.style.transform = Object.assign(new DOMMatrix(getComputedStyle(which).transform), {
            e: this.$press.snapshot.target.transform.e + this.$drag.tx,
            f: this.$press.snapshot.target.transform.f + this.$drag.ty, 
        });
    }
    #commitSwap = (target, onto) => {
        let marker = E('span');
        target.before(marker);
        onto.before(target);
        marker.replaceWith(onto);
        this.#revertTransform([target, this.$press.snapshot.target], [onto, this.$lift.snapshot.onto]);
        PointerInteraction.swapping = false;
    }
    #revertTransform = (...pairs) => pairs.forEach(([el, snapshot]) => el.style.transform = snapshot.transform);
    static #roots = new Set();
    static #css = () => new CSSStyleSheet().replace(`
        .PI-draggable,.PI-target {
            touch-action: none; user-select: none;

            a&,img&,a,img {-webkit-user-drag: none;}
        }
        .PI-dragged,.PI-scrollable:has(:is(.PI-dragged,.PI-animate)) {
            z-index: 1; position: relative;
        }
        .PI-animate {
            z-index: 2; position: relative;
            transition: transform .5s;
        }
        .PI-dragged,.PI-animate {pointer-events: none;}
        .PI-scrollable {
            overflow: scroll; scrollbar-width: none;
            contain: layout;
            
            &:has(.PI-target,.PI-animate) {
                overflow: visible;
                transform: translate(calc(var(--scrolledX,0)*-1px), calc(var(--scrolledY,0)*-1px));
            }
        }
    `);
    static to = {
        elements: els => [els].flat().flatMap(el => typeof el == 'string' ? Q(el) : el).filter(el => el)
    }
    static events = settings => {
        settings = new O(settings).map(([targets, actions]) => [targets, new PointerInteraction(targets, actions)]);
        PointerInteraction.#css().then(css => PointerInteraction.#roots.forEach(root => {
            root.adoptedStyleSheets.push(css);
            root.addEventListener('pointerdown', ev => PointerInteraction.#pointerdown(ev, settings))
        }));
    }
    static #pointerdown = (ev, settings) => {
        let target;
        let pairs = settings.filter(([targets]) => typeof targets == 'string' ? 
            ev.target.matches(targets) : 
            [targets].flat().includes(ev.target)
        );
        !pairs.size && (pairs = settings.filter(([targets]) => {
            let found = typeof targets == 'string' ? 
                ev.target.closest(targets) : 
                [targets].flat().includes(ev.target.assignedSlot);
            found && (target = ev.target.closest(targets) ?? ev.target.assignedSlot);
            return found;
        }));
        if (!pairs.size) return;
        pairs.each(([, PI]) => PI.execute(ev, target));
    }
    static classes = {
        target: ['PI-target', 'PI-dragged', 'PI-reached'],
        onto: ['PI-droppable', 'PI-receiving']
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
    #timers = [];
    constructor(PI) {super(PI);}
    abort = () => this.actions.at(-1).push(true) && this;
    fire = () => {
        let target = this.PI.target;
        this.#timers.forEach(([times, timer]) => times < target.clicked && clearTimeout(timer));
        this.actions.forEach(([times, action, abort]) => target.clicked == times && 
            this.#timers.push([target.clicked, setTimeout(() => action(this.PI, target), abort ? 350 : 0)]));
    }
}
export default PointerInteraction
