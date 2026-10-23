/* SECTOR — bot personalities: how each one plays, and what it says.
   Shared by the server (the bot reads `play`, the banter reads `lines`) and the client (names and blurbs in the lobby).
   `play` nudges the bot's normal judgement rather than replacing it, so a Hard Warlord is still a Hard bot. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SectorPersonas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // play:
  //   attack   added to the odds it needs before it attacks (lower = bolder)
  //   guard    times how hard it holds the front     tactics  times how keen it is to play tactic cards
  //   heli     times how carefully it flies helicopters   noise  added to how erratic its moves are
  //   income   added to the card value it wants before taking a card over income (higher = takes income more)
  //   cls      deploy bonus by unit class (inf, veh, air, sea, art)    def  deploy bonus per point of DEF
  //   prey     how much it picks on the weakest neighbour      grudge  how long and hard it hunts whoever hurt it
  //   diplo    how keen on pacts (offers sooner)              ruthless  added to how readily it betrays
  //   build    extra building habits: bunkers, economy, port, hq
  //   greed    times how much it wants from a trade
  const PERSONAS = {
    warlord: {
      name: 'Warlord', icon: '⚔', blurb: 'Attacks early and often, and loves armour.',
      play: { attack: -0.05, guard: 0.75, income: -0.4, cls: { veh: 1.2, inf: 0.3 }, prey: 1 },
      lines: {
        start: ['Fuel the tanks. We roll at dawn.', 'I hope you all brought spare HQs.', 'Peace was never on the table.'],
        win: ['Steel beats flesh, {name}.', 'Is that all you had, {name}?', 'Next hex. And the next. And the next.'],
        hold: ['You hit like a supply clerk, {name}.', 'Try that again. I dare you.'],
        loss: ['Lucky dice, {name}. Enjoy them while they last.', 'A setback. Bring up the reserves!'],
        hq: ['{name}, your HQ has a new owner.', 'Raise my flag over their capital!'],
        hqLost: ['They took my HQ?! Every unit, turn around!', 'You will pay for that, {name}.'],
        kill: ['{name} is finished. Who wants to be next?', 'One down.'],
        dead: ['I fell fighting. Remember that.', 'This isn\'t over... it\'s just... over.'],
        offer: ['{name}, let\'s carve this map up together.'],
        betray: ['Sorry, {name}. War is war.', 'The pact is over, {name}. Brace yourself.'],
        betrayed: ['Traitor! {name}, I will bury you.', 'You picked the wrong commander to cross, {name}.'],
        big: ['Light \'em up.', 'Fire for effect!'],
        victory: ['Total victory. As it was always going to be.'],
        reply: ['Talk is cheap. Tanks aren\'t.', 'Say that to my armoured column.', 'Noted. Now get off my border.', 'Ha! Bold words.'],
      },
    },
    fortress: {
      name: 'Fortress', icon: '🛡', blurb: 'Digs in, fortifies everything, and punishes anyone who attacks.',
      play: { attack: 0.07, guard: 1.35, income: 0.2, def: 0.35, build: { bunkers: true, hq: true } },
      lines: {
        start: ['Pour the concrete.', 'We hold. Whatever comes.', 'Walls first. Questions later.'],
        win: ['A measured advance.', 'Ground taken. Now we dig in.'],
        hold: ['The line holds, {name}.', 'You broke your teeth on my walls, {name}.', 'Thank you for the target practice.'],
        loss: ['A breach. Seal it.', 'Fall back to the second line.'],
        hq: ['Their capital is ours. Fortify it.'],
        hqLost: ['The citadel has fallen... retake it at any cost!'],
        kill: ['{name} has been removed from the board.'],
        dead: ['Even the strongest walls fall eventually.'],
        offer: ['{name}, a defensive pact? We both sleep better.'],
        betray: ['I\'m afraid our pact has run its course, {name}.'],
        betrayed: ['I trusted you, {name}. That won\'t happen again.'],
        big: ['Precision applied.'],
        victory: ['Patience wins wars.'],
        reply: ['My walls are listening.', 'Come and try, then.', 'I can wait all game.', 'Hm.'],
      },
    },
    tycoon: {
      name: 'Tycoon', icon: '💰', blurb: 'Builds an economy first, then buries you under a bigger army.',
      play: { attack: 0.03, income: 0.9, greed: 0.85, build: { economy: true }, late: 8 },
      lines: {
        start: ['Let\'s talk about growth.', 'War is just business with louder meetings.', 'Every hex is an investment.'],
        win: ['Hostile takeover complete, {name}.', 'Your assets are now my assets.'],
        hold: ['My insurance covers that, {name}.', 'Not for sale, {name}.'],
        loss: ['An acceptable loss. I\'ll buy more.', 'Write it off.'],
        hq: ['I\'ve acquired your headquarters, {name}. Generous terms, too.'],
        hqLost: ['My head office! Somebody call legal!'],
        kill: ['{name} has been liquidated.'],
        dead: ['Bankrupt. Unthinkable.'],
        offer: ['{name}, I have a proposal you\'ll like.'],
        betray: ['Nothing personal, {name}. Just a better deal.'],
        betrayed: ['You\'ve breached our contract, {name}. Expect consequences.'],
        big: ['Money well spent.'],
        victory: ['Market cornered.'],
        reply: ['Interesting offer. Rejected.', 'Everything has a price, you know.', 'Time is money.', 'Let\'s circle back.'],
      },
    },
    sky: {
      name: 'Sky Marshal', icon: '🚁', blurb: 'Rules the air: helicopters, gunships and airstrikes.',
      play: { attack: -0.02, heli: 1.25, tactics: 1.15, cls: { air: 1.8 } },
      lines: {
        start: ['Rotors up.', 'The sky belongs to me.', 'All birds, check in.'],
        win: ['Death from above, {name}.', 'Nothing hides from the air.'],
        hold: ['Look up, {name}. Too late.'],
        loss: ['Bird down! Bird down!', 'Heavy flak. Regroup.'],
        hq: ['Landing on your helipad, {name}. Hope you don\'t mind.'],
        hqLost: ['Grounded? Never.'],
        kill: ['{name} has been shot down.'],
        dead: ['Mayday... mayday...'],
        offer: ['{name}, I\'ll cover your skies if you cover my flank.'],
        betray: ['Change of flight plan, {name}.'],
        betrayed: ['Bandits! {name} has turned on us!'],
        big: ['Bombs away.', 'Danger close!'],
        victory: ['Air superiority achieved.'],
        reply: ['Copy that.', 'Say again? Too much rotor noise.', 'Roger. Ignoring.', 'Look up.'],
      },
    },
    admiral: {
      name: 'Admiral', icon: '⚓', blurb: 'Takes to the sea early: ports, warships and beach landings.',
      play: { cls: { sea: 2.2 }, build: { port: true }, navy: true },
      lines: {
        start: ['Weigh anchor.', 'Whoever holds the sea holds the world.', 'All hands to stations.'],
        win: ['Broadside, {name}!', 'Another shore secured.'],
        hold: ['You\'ll need a bigger boat, {name}.'],
        loss: ['We\'re taking on water.', 'Damage control!'],
        hq: ['{name}, your HQ is now a naval base.'],
        hqLost: ['Abandon... no! Retake that HQ!'],
        kill: ['{name} has been sunk.'],
        dead: ['The captain goes down with the ship.'],
        offer: ['{name}, shall we share the sea lanes?'],
        betray: ['Fire across the bow, {name}. Our pact is over.'],
        betrayed: ['Mutiny! {name}, you scoundrel!'],
        big: ['Fire all batteries!'],
        victory: ['Rule the waves.'],
        reply: ['Aye.', 'Landlubber talk.', 'I\'ll see you on the beaches.', 'Steady as she goes.'],
      },
    },
    viper: {
      name: 'Viper', icon: '🐍', blurb: 'Makes friends, makes plans, and breaks pacts when it pays.',
      play: { diplo: 1, ruthless: 0.45, tactics: 1.2, greed: 1.2 },
      lines: {
        start: ['Friends... so many future friends.', 'Let\'s all get along. For now.', 'Hello, everyone. Don\'t mind me.'],
        win: ['Oh dear, {name}. Did that hurt?', 'Shh. It\'s over now.'],
        hold: ['Did you really think I didn\'t see that coming, {name}?'],
        loss: ['Interesting. I\'ll remember that, {name}.', 'You\'ll regret that.'],
        hq: ['Your HQ was so poorly guarded, {name}.'],
        hqLost: ['How rude.'],
        kill: ['Goodbye, {name}. It was fun.'],
        dead: ['Well played. I\'ll be back, and I\'ll remember.'],
        offer: ['{name}, you and me... we could rule this map.', '{name}, I\'m on your side. Truly.'],
        betray: ['Did you really trust me, {name}?', 'Nothing lasts forever, {name}.', 'Surprise, {name}.'],
        betrayed: ['Oh, {name}. You have no idea who you\'ve upset.'],
        big: ['Oops.'],
        victory: ['Everyone was so very helpful.'],
        reply: ['Of course, friend.', 'I\'d never.', 'Whatever you say.', 'We should talk. Privately.'],
      },
    },
    wildcard: {
      name: 'Wildcard', icon: '🎲', blurb: 'Unpredictable. Takes long shots and throws in every card.',
      play: { attack: -0.07, noise: 1, tactics: 1.3, cards: true },
      lines: {
        start: ['Let\'s roll some dice!', 'Plan? What plan?', 'This is gonna be fun.'],
        win: ['WOO! Did you see that, {name}?!', 'Odds are for cowards.'],
        hold: ['Nope! Not today, {name}!'],
        loss: ['Worth it.', 'Okay, okay, that one was dumb.', 'Double or nothing next time.'],
        hq: ['I took your HQ, {name}! I didn\'t even have a plan!'],
        hqLost: ['Wait, where\'s my HQ?'],
        kill: ['Bye bye, {name}!'],
        dead: ['GG! Rematch?'],
        offer: ['{name}! Friends? Friends!'],
        betray: ['Plot twist, {name}!', 'I got bored, {name}.'],
        betrayed: ['Ooh, savage, {name}. Respect. Now die.'],
        big: ['YOLO.', 'What does this button do?'],
        victory: ['Somehow, that worked!'],
        reply: ['lol', 'Sure, why not!', 'Spin the wheel!', 'No idea what I\'m doing, and I\'m winning anyway.'],
      },
    },
    avenger: {
      name: 'Avenger', icon: '🔥', blurb: 'Never forgets. Whoever hits it first gets hunted down.',
      play: { grudge: 1, attack: -0.02, guard: 1.05 },
      lines: {
        start: ['Leave me alone and we\'ll get along fine.', 'I don\'t start wars. I finish them.'],
        win: ['You started this, {name}.', 'That\'s one for one, {name}.'],
        hold: ['Big mistake, {name}. Huge.', 'I\'m coming for you now, {name}.'],
        loss: ['I\'ll remember this, {name}.', 'Mark {name}. Priority target.'],
        hq: ['That was for what you did, {name}.'],
        hqLost: ['{name}... I will find you.'],
        kill: ['Debt paid, {name}.'],
        dead: ['Someone... avenge me.'],
        offer: ['{name}, help me hunt down the one who started this.'],
        betray: ['You\'ve become what I hate, {name}.'],
        betrayed: ['{name}. You\'re next. You\'re all I think about now.'],
        big: ['Retribution.'],
        victory: ['Justice.'],
        reply: ['Did you attack me? Then we have no problem.', 'I\'m watching you.', 'Keep talking.'],
      },
    },
  };
  const IDS = Object.keys(PERSONAS);
  const pick = (rng = Math.random) => IDS[Math.floor(rng() * IDS.length)];
  // a line for this moment, with {name} filled in (null if this persona has nothing to say about it)
  function line(id, kind, vars = {}, rng = Math.random) {
    const P = PERSONAS[id], list = P && P.lines[kind]; if (!list || !list.length) return null;
    return list[Math.floor(rng() * list.length)].replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? vars[k] : '');
  }
  return { PERSONAS, IDS, pick, line };
});
