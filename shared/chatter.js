/* SECTOR — bot table talk. Bots with a persona say a line in chat when something happens to them, like a player would.
   chatter(state, events) returns [{ pid, text }]. {n} is the other commander's name. */
'use strict';
const E = require('./engine');

// generic lines, used when a persona has nothing of its own for the moment
const ANY = {
  greet: ['glhf', 'Good luck, commanders.', 'Let\'s see what you\'ve got.', 'gl all'],
  win: ['That one\'s mine, {n}.', 'Thanks for the hex, {n}.', 'Should have brought more, {n}.'],
  lose: ['Ugh. Bad dice.', 'That should have worked.', 'Fine. Keep it, {n}. For now.'],
  hurt: ['Hey! That was my hex, {n}.', 'Rude, {n}.', 'Oh, so that\'s how it is.'],
  hold: ['Nice try, {n}.', 'Not today, {n}.', 'Bounced right off.'],
  siege: ['Knock knock, {n}.', 'Your HQ is looking very undefended, {n}.'],
  besieged: ['{n} is in my HQ! Everyone back!', 'No no no no.', 'Get OUT of my base, {n}.'],
  kill: ['GG {n}.', 'And {n} is gone.', 'One down.'],
  dead: ['gg', 'Well played, {n}. gg', 'I\'ll remember this, {n}.'],
  pact: ['Deal, {n}. Watch my back.', 'Allies it is, {n}.'],
  snub: ['Your loss, {n}.', 'Fine. Be like that, {n}.'],
  decline: ['No thanks, {n}.', 'I don\'t think so, {n}.', 'Not a chance.'],
  betray: ['Sorry, {n}. Nothing personal.', 'Pact\'s off, {n}.', 'It was fun while it lasted, {n}.'],
  betrayed: ['Really, {n}? REALLY?', 'Traitor!', 'You\'ll pay for that, {n}.'],
  tradeYes: ['Pleasure doing business, {n}.', 'Deal.'],
  tradeNo: ['Nope.', 'Try again with a better offer, {n}.', 'You must think I was born yesterday, {n}.'],
  victory: ['GG everyone!', 'Victory. gg wp'],
};
const PERSONA = {
  warlord: {
    greet: ['Let\'s have a war.', 'I hope you all brought shovels. You\'ll need graves.', 'Peace is for the weak. glhf'],
    win: ['CRUSHED.', 'Next!', 'Is that all, {n}?', 'Forward! Always forward!'],
    lose: ['Again! We go again!', 'A setback. Send more men.'],
    hurt: ['Oh, you want a fight, {n}? You\'ve got one.', 'You just made the worst mistake of your life, {n}.'],
    hold: ['Come on {n}, hit me harder than that.'],
    siege: ['Your HQ is MINE, {n}.', 'Surrender, {n}.'],
    kill: ['Who\'s next?', 'Wiped off the map. Who\'s next?'],
    dead: ['I die standing. gg', 'Avenge me...'],
    decline: ['Allies? I don\'t need allies, {n}.', 'I fight alone.'],
    victory: ['As it was always going to be.', 'Kneel.'],
  },
  turtle: {
    greet: ['I\'ll just be over here. Building walls.', 'Please don\'t attack me, I\'m very boring.'],
    win: ['Sorry {n}, you left it open.', 'Careful, careful... got it.'],
    hurt: ['Hey, I was minding my own business, {n}!', 'Okay, okay. More bunkers.'],
    hold: ['The wall holds.', 'That\'s what the bunkers are for, {n}.', 'Turtle power.'],
    besieged: ['How did you get through the bunkers, {n}?!'],
    dead: ['Should have built one more bunker. gg'],
    pact: ['Excellent. You go that way, I stay here.'],
    victory: ['Slow and steady. gg'],
  },
  tycoon: {
    greet: ['Let\'s keep this civil. War is bad for business.', 'Anyone want to trade? Anyone? gl'],
    win: ['A hostile takeover, {n}.', 'Acquired.', 'I\'ll be needing that refinery, {n}.'],
    lose: ['That was an expensive mistake.', 'Write it off.'],
    hurt: ['Do you know how much that cost me, {n}?', 'I\'m sending you the bill, {n}.'],
    hold: ['Money well spent.'],
    besieged: ['Okay, let\'s negotiate, {n}.'],
    dead: ['Liquidated. gg'],
    pact: ['A fine partnership, {n}.'],
    tradeYes: ['Lovely doing business with you, {n}.', 'Sold!', 'A fair deal. Come again, {n}.'],
    tradeNo: ['I can\'t make that work, {n}. Sweeten it?', 'My accountant says no.'],
    victory: ['Everything has a price. Even the world.'],
  },
  schemer: {
    greet: ['Hello, friends. I do so love making friends.', 'May the most trustworthy commander win. ;)'],
    win: ['Oh dear, {n}. Didn\'t see that coming?'],
    hurt: ['I\'ll remember that, {n}.', 'Noted, {n}. Noted.'],
    besieged: ['{n}, darling, surely we can come to an arrangement?'],
    pact: ['Friends forever, {n}. Truly.', 'Together we\'re unstoppable, {n}. ;)'],
    snub: ['A pity, {n}. A real pity. For you.'],
    betray: ['Did you really think it would last, {n}?', 'Business is business, {n}.', 'Oops. ;)'],
    betrayed: ['How dare you, {n}. That was MY move.', 'Ha. Well played, {n}. Watch your back.'],
    kill: ['They trusted the wrong people.'],
    dead: ['You haven\'t seen the last of me...'],
    victory: ['Everything went according to plan.'],
  },
  raider: {
    greet: ['Loot first, questions later.', 'Nice stuff you\'ve all got. Shame if something happened to it.'],
    win: ['Yoink.', 'Thanks for the goodies, {n}.', 'Grab it and go!'],
    lose: ['Run for it!'],
    hurt: ['Can\'t catch what you can\'t find, {n}.'],
    siege: ['Ooh, {n}\'s HQ. Bet there\'s loot in there.'],
    kill: ['Picked clean.', 'Everything {n} owned is mine now.'],
    dead: ['Worth it for the crates. gg'],
    tradeNo: ['Ha! You call that a deal?'],
  },
  admiral: {
    greet: ['The sea is mine. Feel free to keep the dirt.', 'Anchors aweigh. glhf'],
    win: ['Beach secured.', 'The fleet sends its regards, {n}.'],
    hurt: ['Landlubbers.'],
    siege: ['Marines are in your base, {n}.'],
    dead: ['A captain goes down with the ship. gg'],
    victory: ['Rule the waves, rule the world.'],
  },
  paladin: {
    greet: ['Fight with honour, all of you.', 'May the best commander win. gl'],
    win: ['For the cause.', 'Yield, {n}.'],
    hurt: ['You struck first, {n}. I will finish it.'],
    hold: ['We stand firm.'],
    pact: ['You have my word, {n}. And I keep it.', 'My shield is yours, {n}.'],
    decline: ['I don\'t trust you, {n}.'],
    betrayed: ['You broke your oath, {n}. I will not forget.', 'Dishonourable, {n}. You will answer for this.'],
    kill: ['Justice.', 'Rest now, {n}.'],
    dead: ['I fell with honour. gg'],
    victory: ['For honour. gg all'],
  },
};
// big moments get said every time (if the persona is chatty at all); small ones are rationed
const BIG = new Set(['besieged', 'siege', 'kill', 'dead', 'betray', 'betrayed', 'victory', 'pact']);

function clean(n) { return String(n || '').replace(/ \(bot\)$/, ''); }
function line(persona, key, other) {
  const own = (PERSONA[persona] || {})[key], any = ANY[key];
  const pool = own && (Math.random() < 0.75 || !any) ? own : any;
  if (!pool) return null;
  return pool[Math.floor(Math.random() * pool.length)].replace(/\{n\}/g, clean(other && other.name));
}

function chatter(s, events) {
  if (!s || !events || !events.length || s.phase === 'over' && !events.some(e => e.e === 'win')) return [];
  const out = [], said = new Set();
  const chatty = { warlord: 0.75, turtle: 0.45, tycoon: 0.6, schemer: 0.8, raider: 0.7, admiral: 0.6, paladin: 0.6 };
  const human = id => { const q = E.player(s, id); return q && !q.bot; };
  const say = (pid, key, otherId) => {
    const p = E.player(s, pid);
    if (!p || !p.bot || !p.persona || said.has(pid)) return;
    s.botMem = s.botMem || {}; const bm = s.botMem[pid] = s.botMem[pid] || {};
    const now = s.turn ? s.turn.round : 0, big = BIG.has(key);
    if (!big && bm.chatRound === now) return;                               // one small remark a round
    if (Math.random() > (chatty[p.persona] || 0.6) * (big ? 1.25 : 0.55)) return;
    const text = line(p.persona, key, otherId && E.player(s, otherId)); if (!text) return;
    bm.chatRound = now; said.add(pid);
    out.push({ pid, text });
  };
  for (const e of events) {
    if (e.e === 'turn' && e.round === 1) say(e.pid, 'greet');
    else if (e.e === 'combat') {
      // talk back to humans in fights; bot-vs-bot scuffles stay quiet
      const att = e.att && e.att.pid, def = e.def && e.def.pid; if (!att || !def) continue;
      if (human(def)) say(att, e.attWin ? 'win' : 'lose', def);
      if (human(att)) say(def, e.attWin ? 'hurt' : 'hold', att);
    }
    else if (e.e === 'siege') { say(e.pid, 'siege', e.victim); say(e.victim, 'besieged', e.pid); }
    else if (e.e === 'eliminate') { say(e.pid, 'dead', e.by); if (e.by) say(e.by, 'kill', e.pid); }
    else if (e.e === 'ally') {
      if (e.status === 'formed') { say(e.to, 'pact', e.from); say(e.from, 'pact', e.to); }
      else if (e.status === 'declined') { say(e.to, 'decline', e.from); say(e.from, 'snub', e.to); }
      else if (e.status === 'breaking') { say(e.from, 'betray', e.to); say(e.to, 'betrayed', e.from); }
    }
    else if (e.e === 'trade' && (e.status === 'accepted' || e.status === 'declined')) say(e.to, e.status === 'accepted' ? 'tradeYes' : 'tradeNo', e.from);
    else if (e.e === 'win') say(e.pid, 'victory');
  }
  return out;
}
module.exports = { chatter, PERSONA, ANY };
