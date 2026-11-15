// English → Marathi (Devanagari) for blue BMC-style street-name and direction boards.
// OpenStreetMap carries `name:mr` for only ~5 % of Mumbai's roads; the rest are written out
// here: a dictionary of the words that make up most Mumbai road names (titles, leaders,
// saints, places, Marg/Road/Lane…), then a phonetic fallback for everything else, the way an
// Indian sign painter spells an English name in Devanagari. Initials are spelt as letters
// ("P J Ramchandani Marg" → "पी जे रामचंदानी मार्ग"), numbers in Devanagari digits.

const WORDS = {
  // Street words
  road: 'रोड', rd: 'रोड', marg: 'मार्ग', mg: 'मार्ग', street: 'स्ट्रीट', lane: 'लेन', gali: 'गल्ली', galli: 'गल्ली', gully: 'गल्ली', path: 'पथ',
  chowk: 'चौक', nagar: 'नगर', cross: 'क्रॉस', no: 'क्र.', number: 'क्र.', avenue: 'ॲव्हेन्यू', circle: 'सर्कल', junction: 'जंक्शन',
  bridge: 'पूल', flyover: 'उड्डाणपूल', highway: 'महामार्ग', express: 'द्रुतगती', expressway: 'द्रुतगती मार्ग', link: 'लिंक', linking: 'लिंकिंग',
  station: 'स्टेशन', market: 'मार्केट', bazaar: 'बाजार', bazar: 'बाजार', wadi: 'वाडी', wada: 'वाडा', colony: 'कॉलनी', society: 'सोसायटी',
  village: 'गाव', gaon: 'गाव', baug: 'बाग', bagh: 'बाग', park: 'पार्क', hill: 'हिल', main: 'मुख्य', new: 'नवीन', old: 'जुना', service: 'सर्व्हिस',
  bunder: 'बंदर', bandar: 'बंदर', estate: 'इस्टेट', compound: 'कंपाउंड', sea: 'सी', face: 'फेस', drive: 'ड्राइव्ह', ghat: 'घाट', tank: 'तलाव',
  west: 'पश्चिम', east: 'पूर्व', north: 'उत्तर', south: 'दक्षिण', western: 'पश्चिम', eastern: 'पूर्व', central: 'सेंट्रल', upper: 'अप्पर', lower: 'लोअर',
  first: 'पहिली', second: 'दुसरी', third: 'तिसरी', fourth: 'चौथी', fifth: 'पाचवी', extension: 'विस्तार', approach: 'अप्रोच', slip: 'स्लिप',
  // Titles
  dr: 'डॉ.', doctor: 'डॉ.', sir: 'सर', smt: 'श्रीमती', shrimati: 'श्रीमती', shri: 'श्री', shree: 'श्री', sri: 'श्री', sant: 'संत', saint: 'सेंट',
  maharshi: 'महर्षी', mahatma: 'महात्मा', swami: 'स्वामी', guru: 'गुरु', pandit: 'पंडित', lt: 'ले.', col: 'कर्नल', capt: 'कॅप्टन', captain: 'कॅप्टन',
  general: 'जनरल', justice: 'न्यायमूर्ती', bai: 'बाई', seth: 'शेठ', sheth: 'शेठ', raja: 'राजा', rani: 'राणी', maharaj: 'महाराज', maharani: 'महाराणी',
  veer: 'वीर', shahid: 'शहीद', hutatma: 'हुतात्मा', lokmanya: 'लोकमान्य', netaji: 'नेताजी', sardar: 'सरदार', babasaheb: 'बाबासाहेब', acharya: 'आचार्य',
  // Names common on Mumbai roads
  gandhi: 'गांधी', subhash: 'सुभाष', chandra: 'चंद्र', bose: 'बोस', vivekanand: 'विवेकानंद', vivekananda: 'विवेकानंद', shivaji: 'शिवाजी',
  chhatrapati: 'छत्रपती', ambedkar: 'आंबेडकर', tilak: 'टिळक', nehru: 'नेहरू', jawaharlal: 'जवाहरलाल', vallabhbhai: 'वल्लभभाई', patel: 'पटेल',
  savarkar: 'सावरकर', annie: 'ॲनी', besant: 'बेझंट', bhagat: 'भगत', singh: 'सिंग', mohammed: 'मोहम्मद', mohamed: 'मोहम्मद', muhammad: 'मुहम्मद',
  ali: 'अली', khan: 'खान', abdul: 'अब्दुल', rehman: 'रहमान', rahman: 'रहमान', hussain: 'हुसेन', husain: 'हुसेन', shaukat: 'शौकत', maulana: 'मौलाना',
  azad: 'आझाद', jinnah: 'जिना', dadabhai: 'दादाभाई', naoroji: 'नौरोजी', pherozeshah: 'फिरोजशाह', mehta: 'मेहता', jamshedji: 'जमशेदजी', tata: 'टाटा',
  jehangir: 'जहांगीर', cowasji: 'कावसजी', bhaurao: 'भाऊराव', karmaveer: 'कर्मवीर', patil: 'पाटील', jyotiba: 'ज्योतिबा', phule: 'फुले', savitribai: 'सावित्रीबाई',
  rajendra: 'राजेंद्र', prasad: 'प्रसाद', lal: 'लाल', bahadur: 'बहादूर', shastri: 'शास्त्री', indira: 'इंदिरा', rajiv: 'राजीव', sanjay: 'संजय',
  ganesh: 'गणेश', ganpati: 'गणपती', hanuman: 'हनुमान', maruti: 'मारुती', ram: 'राम', krishna: 'कृष्ण', laxmi: 'लक्ष्मी', lakshmi: 'लक्ष्मी',
  shankar: 'शंकर', narayan: 'नारायण', vithal: 'विठ्ठल', vithalbhai: 'विठ्ठलभाई', vitthal: 'विठ्ठल', jagannath: 'जगन्नाथ', shankarsheth: 'शंकरशेठ',
  vishnu: 'विष्णू', shiv: 'शिव', datta: 'दत्त', sai: 'साई', baba: 'बाबा', mata: 'माता', devi: 'देवी', mandir: 'मंदिर', masjid: 'मशीद', church: 'चर्च',
  mumba: 'मुंबा', bhuleshwar: 'भुलेश्वर', kalbadevi: 'काळबादेवी', walkeshwar: 'वाळकेश्वर', babulnath: 'बाबुलनाथ', mahalaxmi: 'महालक्ष्मी', mahalakshmi: 'महालक्ष्मी',
  siddhivinayak: 'सिद्धिविनायक', mount: 'माउंट', mary: 'मेरी', joseph: 'जोसेफ', john: 'जॉन', paul: 'पॉल', peter: 'पीटर', thomas: 'थॉमस', francis: 'फ्रान्सिस',
  pedder: 'पेडर', warden: 'वॉर्डन', napean: 'नेपियन', carmichael: 'कारमायकल', altamount: 'अल्टामाउंट', nepean: 'नेपियन', cuffe: 'कफ',
  parade: 'परेड', marine: 'मरीन', apollo: 'अपोलो', colaba: 'कुलाबा', causeway: 'कॉजवे', henry: 'हेन्री', wodehouse: 'वुडहाउस', nariman: 'नरिमन',
  point: 'पॉइंट', churchgate: 'चर्चगेट', fort: 'फोर्ट', ballard: 'बॅलार्ड', crawford: 'क्रॉफर्ड', carnac: 'कर्नाक',
  lamington: 'लॅमिंग्टन', grant: 'ग्रँट', hughes: 'ह्यूज', bellasis: 'बेलासिस', clare: 'क्लेअर', hornby: 'हॉर्नबी', frere: 'फ्रेअर', reay: 'रे',
  // Places
  mumbai: 'मुंबई', bombay: 'मुंबई', worli: 'वरळी', dadar: 'दादर', bandra: 'वांद्रे', mahim: 'माहीम', sion: 'शीव', kurla: 'कुर्ला', andheri: 'अंधेरी',
  juhu: 'जुहू', powai: 'पवई', parel: 'परळ', byculla: 'भायखळा', girgaon: 'गिरगाव', matunga: 'माटुंगा', wadala: 'वडाळा', chembur: 'चेंबूर',
  ghatkopar: 'घाटकोपर', santacruz: 'सांताक्रूझ', khar: 'खार', vile: 'विले', parle: 'पार्ले', tardeo: 'ताडदेव', mazgaon: 'माझगाव', sewri: 'शिवडी',
  prabhadevi: 'प्रभादेवी', lalbaug: 'लालबाग', chinchpokli: 'चिंचपोकळी', agripada: 'आग्रीपाडा', nagpada: 'नागपाडा', dongri: 'डोंगरी', mandvi: 'मांडवी',
  dharavi: 'धारावी', kalina: 'कलिना', vakola: 'वाकोला', saki: 'साकी', naka: 'नाका', marol: 'मरोळ', chakala: 'चकाला', versova: 'वर्सोवा',
  jogeshwari: 'जोगेश्वरी', goregaon: 'गोरेगाव', malad: 'मालाड', borivali: 'बोरिवली', thane: 'ठाणे', vikhroli: 'विक्रोळी', bhandup: 'भांडुप',
  mulund: 'मुलुंड', vidyavihar: 'विद्याविहार', tilaknagar: 'टिळकनगर', govandi: 'गोवंडी', mankhurd: 'मानखुर्द', deonar: 'देवनार', trombay: 'तुर्भे',
  chowpatty: 'चौपाटी', gamdevi: 'गावदेवी', kemps: 'केम्प्स', corner: 'कॉर्नर', haji: 'हाजी', bhendi: 'भेंडी', koliwada: 'कोळीवाडा',
  airport: 'विमानतळ', sahar: 'सहार', international: 'आंतरराष्ट्रीय', domestic: 'देशांतर्गत', bkc: 'वांद्रे-कुर्ला संकुल', complex: 'संकुल',
  // English words on Mumbai road names
  scheme: 'स्कीम', temple: 'टेंपल', school: 'स्कूल', college: 'कॉलेज', hospital: 'हॉस्पिटल', garden: 'गार्डन', gardens: 'गार्डन', police: 'पोलीस',
  gate: 'गेट', lake: 'लेक', site: 'साइट', industrial: 'औद्योगिक', internal: 'अंतर्गत', connector: 'कनेक्टर', promenade: 'प्रोमेनेड', subway: 'सबवे',
  skywalk: 'स्कायवॉक', walkway: 'वॉकवे', walk: 'वॉक', railway: 'रेल्वे', freeway: 'फ्रीवे', parking: 'पार्किंग', ramp: 'रॅम्प', exit: 'एक्झिट',
  bus: 'बस', depot: 'डेपो', metro: 'मेट्रो', pedestrian: 'पादचारी', library: 'ग्रंथालय', cinema: 'सिनेमा', private: 'खाजगी', farm: 'फार्म',
  father: 'फादर', lady: 'लेडी', green: 'ग्रीन', coastal: 'कोस्टल', convent: 'कॉन्व्हेंट', club: 'क्लब', court: 'कोर्ट', office: 'ऑफिस', post: 'पोस्ट',
  municipal: 'म्युनिसिपल', corporation: 'कॉर्पोरेशन', barrister: 'बॅरिस्टर', military: 'मिलिटरी', terminus: 'टर्मिनस', elevated: 'उन्नत', caves: 'लेणी', ward: 'वॉर्ड', block: 'ब्लॉक', sector: 'सेक्टर', plot: 'प्लॉट', building: 'बिल्डिंग', tower: 'टॉवर',
  apartment: 'अपार्टमेंट', chawl: 'चाळ', chawls: 'चाळी', mill: 'मिल', mills: 'मिल्स', dock: 'डॉक', docks: 'डॉक', port: 'पोर्ट', trust: 'ट्रस्ट',
  // Surnames and names that recur on road boards
  khetwadi: 'खेतवाडी', nowroji: 'नौरोजी', parsi: 'पारसी', joshi: 'जोशी', rao: 'राव', desai: 'देसाई', shah: 'शाह', vihar: 'विहार', danda: 'दांडा',
  naik: 'नाईक', parekh: 'पारेख', kadam: 'कदम', tejpal: 'तेजपाल', petit: 'पेटिट', modi: 'मोदी', bhavan: 'भवन', sawant: 'सावंत', jadhav: 'जाधव',
  prakash: 'प्रकाश', kher: 'खेर', patkar: 'पाटकर', nathalal: 'नथालाल', bhaskar: 'भास्कर', jain: 'जैन', parulekar: 'परुळेकर', raheja: 'रहेजा',
  anant: 'अनंत', rathod: 'राठोड', clive: 'क्लाइव्ह', gamadia: 'गमाडिया', barve: 'बर्वे', gulmohar: 'गुलमोहर', ashram: 'आश्रम', tayyabji: 'तय्यबजी',
  homi: 'होमी', keshav: 'केशव', jeejeebhoy: 'जीजीभॉय', sayed: 'सय्यद', syed: 'सय्यद', boman: 'बोमन', behram: 'बेहराम', vidya: 'विद्या', master: 'मास्टर',
  dinshaw: 'दिनशॉ', bharucha: 'भरूचा', bhosle: 'भोसले', bhonsle: 'भोसले', ahmed: 'अहमद', wadia: 'वाडिया', derasar: 'देरासर', vaidya: 'वैद्य',
  dadasaheb: 'दादासाहेब', guruji: 'गुरुजी', balu: 'बाळू', mohalla: 'मोहल्ला', tandel: 'तांडेल', bapurao: 'बापूराव', dubash: 'दुभाष', tara: 'तारा',
  tukaram: 'तुकाराम', vasantrao: 'वसंतराव', ramchandra: 'रामचंद्र', ramakrishna: 'रामकृष्ण', maroshi: 'मरोशी', nagardas: 'नगरदास', peerkhan: 'पीरखान',
  santa: 'सांता', cruz: 'क्रूझ', manish: 'मनीष', gaikwad: 'गायकवाड', periera: 'परेरा', pereira: 'परेरा', dsouza: 'डिसोझा', souza: 'सोझा', fernandes: 'फर्नांडिस',
  gokhale: 'गोखले', ranade: 'रानडे', bapat: 'बापट', senapati: 'सेनापती', kelkar: 'केळकर', agarkar: 'आगरकर', keluskar: 'केळुसकर', apte: 'आपटे',
  gupte: 'गुप्ते', kamat: 'कामत', shinde: 'शिंदे', pawar: 'पवार', more: 'मोरे', salvi: 'साळवी', sathe: 'साठे', kulkarni: 'कुलकर्णी', deshmukh: 'देशमुख',
  deshpande: 'देशपांडे', thakur: 'ठाकूर', thakre: 'ठाकरे', thackeray: 'ठाकरे', chavan: 'चव्हाण', mhatre: 'म्हात्रे', koli: 'कोळी', mane: 'माने',
  ramchandani: 'रामचंदानी', mangaldas: 'मंगलदास', bhulabhai: 'भुलाभाई', thakurdwar: 'ठाकूरद्वार', tulsi: 'तुळशी', pipe: 'पाइप', turner: 'टर्नर',
  pais: 'पाईस', yusuf: 'युसूफ', meherally: 'मेहेरअली', abdulla: 'अब्दुल्ला', ismail: 'इस्माईल', ibrahim: 'इब्राहीम', rafi: 'रफी', ahmad: 'अहमद',
  merchant: 'मर्चंट', mehra: 'मेहरा', kapoor: 'कपूर', sharma: 'शर्मा', gupta: 'गुप्ता', agarwal: 'अगरवाल', jhaveri: 'झवेरी', zaveri: 'झवेरी', vora: 'व्होरा',
  sheikh: 'शेख', memon: 'मेमन', kazi: 'काझी', qazi: 'काझी', noor: 'नूर', bohri: 'बोहरी', bohra: 'बोहरा', dawoodi: 'दाऊदी', pathan: 'पठाण',
  mahadev: 'महादेव', bhagwan: 'भगवान', govind: 'गोविंद', gopal: 'गोपाळ', madhav: 'माधव', vinayak: 'विनायक', bal: 'बाळ', gangadhar: 'गंगाधर',
  madame: 'मादाम', cama: 'कामा', pipeline: 'पाइपलाइन', phase: 'फेज', swatantrya: 'स्वातंत्र्य', panvel: 'पनवेल', vasanji: 'वासनजी',
  sankaracharya: 'शंकराचार्य', shankaracharya: 'शंकराचार्य', gurunanak: 'गुरुनानक', nanak: 'नानक', baji: 'बाजी', patthe: 'पठ्ठे', falkland: 'फॉकलंड',
  kataria: 'कटारिया', mahul: 'माहुल', moses: 'मोझेस', feet: 'फीट', vincent: 'व्हिन्सेंट', charni: 'चर्नी', kidwai: 'किडवाई', bole: 'बोले',
  mathura: 'मथुरा', mohan: 'मोहन', jag: 'जग', laxmibai: 'लक्ष्मीबाई', bahadur: 'बहादूर',
  silver: 'सिल्व्हर', oaks: 'ओक्स', nivas: 'निवास', niwas: 'निवास', shyam: 'श्याम', sadan: 'सदन', agiary: 'अग्यारी', college: 'कॉलेज',
  // Small words
  and: 'आणि', of: '', the: '', to: '', at: '',
};

const LETTERS = { a: 'ए', b: 'बी', c: 'सी', d: 'डी', e: 'ई', f: 'एफ', g: 'जी', h: 'एच', i: 'आय', j: 'जे', k: 'के', l: 'एल', m: 'एम', n: 'एन', o: 'ओ', p: 'पी', q: 'क्यू', r: 'आर', s: 'एस', t: 'टी', u: 'यू', v: 'व्ही', w: 'डब्ल्यू', x: 'एक्स', y: 'वाय', z: 'झेड' };
const DIGITS = '०१२३४५६७८९';

// Consonant clusters (longest first) and vowels: [independent, matra].
const CONS = [['ksh', 'क्ष'], ['chh', 'छ'], ['shr', 'श्र'], ['ch', 'च'], ['kh', 'ख'], ['gh', 'घ'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'],
  ['k', 'क'], ['g', 'ग'], ['j', 'ज'], ['t', 'ट'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'],
  ['v', 'व'], ['w', 'व'], ['s', 'स'], ['h', 'ह'], ['z', 'झ'], ['f', 'फ'], ['q', 'क'], ['x', 'क्स'], ['c', 'क']];
const VOWELS = [['aa', 'आ', 'ा'], ['ao', 'आव', 'ाव'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ee', 'ई', 'ी'], ['ii', 'ई', 'ी'], ['oo', 'ऊ', 'ू'], ['uu', 'ऊ', 'ू'], ['ou', 'औ', 'ौ'],
  ['a', 'अ', ''], ['e', 'ए', 'े'], ['i', 'इ', 'ि'], ['o', 'ओ', 'ो'], ['u', 'उ', 'ु']];
const VIRAMA = '्', ANUSVARA = 'ं';

/** Split a lower-case word into consonant and vowel tokens. */
function tokens(w) {
  const out = [];
  let i = 0;
  while (i < w.length) {
    const v = VOWELS.find(([k]) => w.startsWith(k, i));
    if (v) { out.push({ v: true, k: v[0], ind: v[1], matra: v[2] }); i += v[0].length; continue; }
    // 'c' before e/i/y sounds like s; 'y' after a consonant at the end of a word is a long i.
    if (w[i] === 'c' && /[eiy]/.test(w[i + 1] || '')) { out.push({ v: false, k: 'c', d: 'स' }); i++; continue; }
    if (w[i] === 'y' && i === w.length - 1 && out.length && !out[out.length - 1].v) { out.push({ v: true, k: 'y', ind: 'ई', matra: 'ी' }); i++; continue; }
    const c = CONS.find(([k]) => w.startsWith(k, i));
    if (c) {
      // A final d is usually retroflex in borrowed words ("road", "ward"); t keeps the retroflex sound.
      const d = c[0] === 'd' && i === w.length - 1 ? 'ड' : c[1];
      out.push({ v: false, k: c[0], d }); i += c[0].length; continue;
    }
    i++; // anything else (apostrophes…) is dropped
  }
  return out;
}

/** Phonetic spelling of one lower-case word. */
function spell(w) {
  // English words ending in -er ("Silver", "Turner") end in a plain र; -oa- is an o ("Oaks").
  if (w.length > 4 && /[^aeiou]er$/.test(w)) w = `${w.slice(0, -2)}ar`;
  w = w.replace(/oa/g, 'o');
  const t = tokens(w);
  let s = '';
  for (let i = 0; i < t.length; i++) {
    const a = t[i], next = t[i + 1];
    if (a.v) {
      const prev = t[i - 1];
      // i or u followed by a: a glide ("Sophia" → सोफिया, "Wadia" → वाडिया, "Ruia" → रुईया).
      if (prev && prev.v && a.k === 'a' && (prev.k === 'i' || prev.k === 'ee')) { s += next ? 'य' : 'या'; continue; }
      if (prev && prev.v && a.k === 'a' && prev.k === 'u') { s += next ? 'व' : 'वा'; continue; }
      if (!prev || prev.v) s += a.ind;
      else if (!next && a.k === 'a') s += 'ा'; // a final -a is long in Indian spellings ("Kurla", "Mehta")
      else if (!next && a.k === 'i') s += 'ी'; // and so are a final -i and -u in Marathi ("Joshi", "Balu")
      else if (!next && a.k === 'u') s += 'ू';
      else if (!next && a.k === 'ai') s += 'ाई'; // "Desai", "bhai"
            else s += a.matra;
      continue;
    }
    if (next && !next.v) {
      // n or m before another consonant: a nasal dot ("Shankar" → शंकर, "Chembur" → चेंबूर).
      if ((a.k === 'n' || a.k === 'm') && !/^(y|r|v|w|h|n|m)$/.test(next.k) && i > 0) { s += ANUSVARA; continue; }
      if (a.k === next.k && a.k === 'h') continue;
      s += a.d + VIRAMA;
      continue;
    }
    s += a.d;
  }
  return s;
}

const dig = (str) => str.replace(/[0-9]/g, (d) => DIGITS[+d]);

// Name endings spelt on their own, so no conjunct forms across them ("Budhkar" → बुधकर, not बुध्कर).
const SUFFIX = [['wala', 'वाला'], ['bhai', 'भाई'], ['bai', 'बाई'], ['dada', 'दादा'], ['nagar', 'नगर'], ['wadi', 'वाडी'], ['pada', 'पाडा'], ['kar', 'कर'], ['das', 'दास'], ['rao', 'राव'], ['ji', 'जी']];
const known = (w) => (w in WORDS && WORDS[w]) || LEARNT.get(w) || null;
/** A word that isn't listed: a listed word plus a name ending, two listed words, or the phonetic spelling. */
function spellWord(low) {
  for (const [suf, dev] of SUFFIX) {
    if (low.length > suf.length + 2 && low.endsWith(suf)) { const stem = low.slice(0, -suf.length); return (known(stem) || spell(stem)) + dev; }
  }
  for (let i = 3; i <= low.length - 3; i++) { const a = known(low.slice(0, i)), b = known(low.slice(i)); if (a && b) return a + b; }
  return spell(low);
}

const LEARNT = new Map();
/**
 * Learn word spellings from names that OpenStreetMap has in both scripts ([english, marathi]
 * pairs): where both have the same number of words, each unknown English word takes the
 * Marathi word in its place (the most common one wins). Real spellings beat the phonetic guess.
 */
export function learnDevanagari(pairs) {
  const votes = new Map();
  for (const [en, mr] of pairs) {
    const a = String(en).replace(/[()]/g, ' ').split(/[\s/,-]+/).filter(Boolean), b = String(mr).replace(/[()]/g, ' ').split(/[\s/,-]+/).filter(Boolean);
    if (a.length !== b.length || a.length < 2) continue;
    a.forEach((w, i) => {
      const k = w.replace(/[^A-Za-z]/g, '').toLowerCase();
      if (k.length < 3 || k in WORDS || !/[\u0900-\u097f]/.test(b[i])) return;
      const m = votes.get(k) || votes.set(k, new Map()).get(k);
      m.set(b[i], (m.get(b[i]) || 0) + 1);
    });
  }
  for (const [k, m] of votes) LEARNT.set(k, [...m].sort((x, y) => y[1] - x[1])[0][0]);
  return LEARNT.size;
}

/** Marathi (Devanagari) for an English road or place name. */
export function toDevanagari(name) {
  const out = [];
  const parts = String(name).replace(/[()]/g, ' ').split(/[\s/,-]+/).filter(Boolean);
  for (let k = 0; k < parts.length; k++) {
    const raw = parts[k];
    const word = raw.replace(/[.']/g, '').replace(/[^A-Za-z0-9&]/g, '');
    if (!word) continue;
    if (word === '&') { out.push('आणि'); continue; }
    if (/^[0-9]+[a-z]*$/i.test(word)) {
      const n = word.replace(/(st|nd|rd|th)$/i, ''), ord = word.length > n.length;
      out.push(dig(n) + (ord ? (/1$/.test(n) ? ' ली' : /[23]$/.test(n) ? ' री' : /4$/.test(n) ? ' थी' : ' वी') : ''));
      continue;
    }
    const low = word.toLowerCase();
    // "St." at the start is Saint; anywhere else Street.
    if (low === 'st') { out.push(k === 0 && parts.length > 1 ? 'सेंट' : 'स्ट्रीट'); continue; }
    if (low in WORDS) { if (WORDS[low]) out.push(WORDS[low]); continue; }
    if (LEARNT.has(low)) { out.push(LEARNT.get(low)); continue; }
    // Initials ("P", "J.", "S.V.", "LBS"): letter names.
    const caps = raw.replace(/[.]/g, '');
    if (/^[A-Z]{1,4}$/.test(caps) && (caps.length === 1 || raw.includes('.') || !/[AEIOU]/.test(caps))) { out.push([...caps.toLowerCase()].map((c) => LETTERS[c]).join(' ')); continue; }
    // Compound words made of dictionary words ("Ramchandani" stays phonetic; "Lalbaug" is listed).
    out.push(dig(spellWord(low)));
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
