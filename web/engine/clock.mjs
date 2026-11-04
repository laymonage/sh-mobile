// The game's clock, which stands still while the tab is hidden. The game loop stops
// then too, so a player can tab away and back and carry on from the same moment.
export class GameClock {
  constructor(realNow = Date.now) {
    this.realNow = realNow;
    this.hiddenSince = null;
    this.hiddenTotal = 0;
  }

  now() {
    return (this.hiddenSince ?? this.realNow()) - this.hiddenTotal;
  }

  setHidden(hidden) {
    if (hidden && this.hiddenSince === null) {
      this.hiddenSince = this.realNow();
    } else if (!hidden && this.hiddenSince !== null) {
      this.hiddenTotal += this.realNow() - this.hiddenSince;
      this.hiddenSince = null;
    }
  }
}
