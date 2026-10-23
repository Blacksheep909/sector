/* SECTOR — what players type. Names and chat are cleaned on the server before anyone else sees them:
   fancy "fonts" become plain letters, invisible and stacked characters are dropped, links are removed and swearing is
   masked. Names are stricter: letters, numbers and a little punctuation, and nothing offensive or official-looking. */
'use strict';

// small-capital and other look-alike letters that Unicode normalisation (NFKC) leaves alone
const LOOKALIKE = { ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ǫ: 'q', ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z',
  ɐ: 'a', ǝ: 'e', ɟ: 'f', ƃ: 'g', ɥ: 'h', ᴉ: 'i', ɾ: 'j', ʞ: 'k', ɯ: 'm', ɹ: 'r', ʇ: 't', ʌ: 'v', ʍ: 'w', ʎ: 'y' };
// numbers and symbols standing in for letters (fvck, sh1t, @ss)
const LEET = { 0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't', '€': 'e', '¢': 'c' };
// swearing: a word that is one of these, or starts with one of the roots (fucking, shitty, bitches)
const EXACT = ['ass', 'arse', 'fag', 'fags', 'dick', 'dicks', 'cock', 'cocks', 'tit', 'tits', 'cum', 'jizz', 'piss', 'crap', 'twat', 'prick', 'pricks', 'homo', 'spic', 'spics', 'kike', 'kikes', 'chink', 'chinks', 'coon', 'coons', 'paki', 'pakis', 'gook', 'gooks', 'dyke', 'dykes', 'nazi', 'nazis', 'rape', 'raped', 'raping', 'rapist', 'kys'];
const ROOTS = ['fuck', 'fuk', 'fck', 'shit', 'shite', 'bitch', 'cunt', 'asshole', 'arsehole', 'bastard', 'whore', 'slut', 'wank', 'bollock', 'dickhead', 'cocksuck', 'motherfuck', 'pussy', 'pussies', 'nigger', 'nigga', 'niger', 'faggot', 'fagot', 'retard', 'tranny', 'trannie', 'wetback', 'beaner', 'raghead', 'towelhead', 'porn', 'hentai', 'dildo', 'blowjob', 'handjob', 'hitler', 'heil'];
// the worst slurs are also caught spelled out with gaps (n i g g e r, n.i.g.g.e.r)
const SPACED = ['nigger', 'nigga', 'faggot', 'retard', 'kys'];
// names that would pass for staff or the game itself
const RESERVED = /^(admin|administrator|mod|moderator|staff|server|system|sector|official|support|dev|developer|owner|claude|anthropic)\b/i;

const leet = w => [...w].map(ch => LEET[ch] || ch).join('');
const squash = w => w.replace(/(.)\1+/g, '$1');   // fuuuuck → fuck
const ROOTS_SQ = ROOTS.map(squash);
function rude(word) {
  const w = leet(word.toLowerCase()), sq = squash(w);
  return EXACT.includes(w) || EXACT.includes(sq) || ROOTS_SQ.some(r => sq.startsWith(r));
}

// characters: plain letters for fancy ones, nothing invisible, no towers of accents, no runs of the same character
function tidy(s, max) {
  s = String(s == null ? '' : s).normalize('NFKC');
  s = [...s].map(ch => LOOKALIKE[ch] || ch).join('');
  s = s.replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}⠀-⣿￰-￿]/gu, '');   // controls, zero-width and direction marks, private use, Braille art
  // no "zalgo": loose accent marks are dropped after Latin, Greek and Cyrillic letters (é and ü are single characters by
  // now), and stacks are cut to one elsewhere (scripts like Hindi need theirs). Emoji keep their style marks
  s = s.replace(/([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}\p{P}\s])(?:(?![\ufe0f\u20e3])\p{M})+/gu, '$1');
  s = s.replace(/(\p{M})(?:(?![\ufe0f\u20e3])\p{M})+/gu, '$1');
  s = s.replace(/\s+/gu, ' ').trim();
  s = s.replace(/(.)\1{4,}/gu, '$1$1$1$1');
  return [...s].slice(0, max).join('').trim();
}

// links, invites and addresses: "www.x.com", "x . com", "x dot gg", "discord.gg/abc", an IP address
const TLD = 'com|net|org|io|gg|xyz|ru|co|uk|me|tv|ly|app|dev|link|site|online|shop|info|biz|tk|ml|ga|cf|gq|be|to|cc|us|de|fr|eu|ca|au|in|cn|top|club|live|store|fun|lol|sh|so|ai';
const LINK = new RegExp([
  '(?:https?|ftp)\\s*:\\s*\\/\\/\\S*',
  '\\bwww\\s*\\.\\s*\\S+',
  '\\b[\\p{L}\\p{N}-]+(?:\\s*(?:\\.|\\(dot\\)|\\[dot\\]|\\bdot\\b)\\s*[\\p{L}\\p{N}-]+)*\\s*(?:\\.|\\(dot\\)|\\[dot\\]|\\bdot\\b)\\s*(?:' + TLD + ')\\b(?:\\/\\S*)?',
  '\\b\\d{1,3}(?:\\s*\\.\\s*\\d{1,3}){3}(?::\\d+)?\\b',
].join('|'), 'giu');

// chat: cleaned, links removed, swearing masked. Returns '' when nothing is left to send
function chat(text) {
  let s = tidy(text, 140);
  s = s.replace(LINK, '[link removed]');
  s = s.replace(/[\p{L}\p{N}@$!|+€¢]+/gu, w => rude(w) ? '*'.repeat([...w].length) : w);
  // a slur spelled out across gaps hides the whole message
  const joined = leet(s.toLowerCase()).replace(/[^a-z]/g, '');
  if (SPACED.some(x => squash(joined).includes(squash(x)))) return '***';
  return s.replace(/^[\s*]+$/, '***');
}

// a name: letters, numbers, spaces and - _ . ' only; nothing rude, no links, nothing official. null when it won't do
function name(raw) {
  let s = tidy(raw, 16).replace(/[^\p{L}\p{N}\p{M} _.'-]/gu, '').replace(/\s+/g, ' ').trim();
  if (!s || !/[\p{L}\p{N}]/u.test(s)) return null;
  if (RESERVED.test(s) || LINK.test(s)) { LINK.lastIndex = 0; return null; }
  LINK.lastIndex = 0;
  if (s.split(/[\s_.'-]+/).some(rude)) return null;
  const joined = squash(leet(s.toLowerCase()).replace(/[^a-z]/g, ''));
  if (ROOTS_SQ.concat(SPACED.map(squash), ['dick', 'cock', 'cunt']).some(r => r.length >= 4 && joined.includes(r))) return null;
  return s;
}

module.exports = { chat, name, tidy };
