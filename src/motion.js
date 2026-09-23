// Millimetres are kept separate from the model's metre units.
export class KeyMotion {
  constructor() { this.travel = 3.4; this.hoverDepth = 0.45; this.reduced = false; this.reset(); }
  reset() { this.depth = 0; this.velocity = 0; this.hovered = false; this.held = false; this.elapsed = null; this.startDepth = 0; this.count = 0; this.state = 'At rest'; }
  press() { if (this.held) return; this.held = true; this.startDepth = this.depth; this.elapsed = 0; this.count++; }
  release() { this.held = false; }
  step(dt) {
    dt = Math.max(0, Math.min(dt, 0.05));
    if (this.elapsed !== null) this.elapsed += dt;
    if (this.held && this.elapsed < 0.085) {
      const t = this.elapsed / 0.085;
      this.depth = this.startDepth + (this.travel - this.startDepth) * (1 - (1 - t) ** 3);
      this.velocity = 0; this.state = 'Pressing';
    } else if (this.held) {
      this.depth = this.travel; this.velocity = 0; this.state = 'Bottomed out';
    } else {
      const returning = this.elapsed !== null;
      const target = returning ? 0 : (this.hovered && !this.reduced ? Math.min(this.hoverDepth, this.travel) : 0);
      const stiffness = this.reduced ? 650 : 420;
      const damping = this.reduced ? 52 : 35;
      const steps = Math.max(1, Math.ceil(dt / 0.008));
      for (let i = 0; i < steps; i++) {
        const h = dt / steps;
        this.velocity += ((target - this.depth) * stiffness - this.velocity * damping) * h;
        this.depth = Math.max(0, Math.min(this.travel, this.depth + this.velocity * h));
      }
      if (Math.abs(this.depth - target) < 0.001 && Math.abs(this.velocity) < 0.02) {
        this.depth = target; this.velocity = 0;
        if (returning) this.elapsed = null;
      }
      this.state = returning ? 'Returning' : target > 0 ? 'Hover' : 'At rest';
    }
    return this.depth;
  }
}
