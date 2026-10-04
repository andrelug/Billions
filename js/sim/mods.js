// Research and wonders change numbers through modifiers instead of mutating
// data. A modifier targets a path such as "unit.ranger.range" or
// "building.*.hp" or "prod.wood" and is either additive or multiplicative.
//   add:  value += n
//   mul:  value *= (1 + sum of percentages)
export class Mods {
  constructor() { this.add = new Map(); this.pct = new Map(); this.set = new Map(); this.flags = new Set(); this.cache = new Map(); }

  apply(list) {
    for (const m of list || []) {
      if (m.flag) { this.flags.add(m.flag); continue; }
      if (m.set != null) { this.set.set(m.path, m.set); continue; }
      const map = m.pct != null ? this.pct : this.add;
      map.set(m.path, (map.get(m.path) || 0) + (m.pct != null ? m.pct : m.add));
    }
    this.cache.clear();
  }

  has(flag) { return this.flags.has(flag); }

  // value for `${group}.${id}.${stat}`, also honouring `${group}.*.${stat}`
  // and tag paths such as `${group}.#ranged.${stat}`.
  stat(group, id, stat, base, tags) {
    const key = group + '.' + id + '.' + stat + (tags ? '|' + tags.join(',') : '');
    let c = this.cache.get(key);
    if (!c) {
      let a = 0, p = 0;
      const paths = [group + '.' + id + '.' + stat, group + '.*.' + stat];
      if (tags) for (const t of tags) paths.push(group + '.#' + t + '.' + stat);
      for (const path of paths) { a += this.add.get(path) || 0; p += this.pct.get(path) || 0; }
      c = { a, p };
      this.cache.set(key, c);
    }
    return (base + c.a) * (1 + c.p);
  }

  // Global scalar such as "refund" or "awareness".
  global(path, base) {
    if (this.set.has(path)) return this.set.get(path);
    return (base + (this.add.get(path) || 0)) * (1 + (this.pct.get(path) || 0));
  }

  serialize() { return { add: [...this.add], pct: [...this.pct], set: [...this.set], flags: [...this.flags] }; }
  static from(s) { const m = new Mods(); if (s) { m.add = new Map(s.add); m.pct = new Map(s.pct); m.set = new Map(s.set || []); m.flags = new Set(s.flags); } return m; }
}

export class Events {
  constructor() { this.l = {}; }
  on(ev, fn) { (this.l[ev] = this.l[ev] || []).push(fn); return () => { this.l[ev] = this.l[ev].filter((f) => f !== fn); }; }
  emit(ev, a, b, c) { const ls = this.l[ev]; if (ls) for (const fn of ls) fn(a, b, c); }
}
