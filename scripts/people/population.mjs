// Who lives in the game: the people built by scripts/people/build-people.mjs.
//
// Each entry is one body template (a MakeHuman body, hair and clothes); the game then dresses
// every passer-by from a template in their own skin tone, hair colour and clothes colours, so
// two dozen templates give a crowd where no two people look alike.
//
// Heights follow Indian adult averages (men about 165 cm, women about 152 cm, with spread).
// `macro`: MakeHuman sliders 0…1 — muscle, weight, proportions (0.5 average; higher = more
// idealised adult proportions), cupsize, firmness and `race` (the ancestry mix MakeHuman
// models: South Asian faces sit between its "caucasian" and "african" sets with some "asian").
// `targets`: face and body details (MakeHuman target names, 0…1).
// `clothes`: [role, MakeHuman asset, options] — role top / bottom / shoes / facial / extra /
// accessory; options.tint: false keeps the fabric's own colours (prints, jeans).
// `kinds`: which of the game's people this body can play (office, casual, worker, sari, kid,
// police, trafficCop, khaki, driver, jogger).
// Every asset's licence (CC0 or CC BY) and author go to public/people/index.json → Credits.

/** Colour slots of the people shader (the `_PART` attribute's first byte). */
export const SLOTS = { keep: 0, skin: 1, hair: 2, top: 3, bottom: 4, shoes: 5, extra: 6, accent: 7 };

/** MakeHuman's age slider from years (0 = 1 year, 0.1875 = 11, 0.5 = 25, 1 = 90). */
export const ageMacro = (y) => (y < 11 ? ((y - 1) / 10) * 0.1875 : y < 25 ? 0.1875 + ((y - 11) / 14) * 0.3125 : Math.min(1, 0.5 + ((y - 25) / 65) * 0.5));

const SA = { caucasian: 0.6, african: 0.24, asian: 0.16 };          // a typical Mumbai mix
const SA2 = { caucasian: 0.52, african: 0.3, asian: 0.18 };          // darker, broader features
const SA3 = { caucasian: 0.68, african: 0.16, asian: 0.16 };         // narrower features
const SA4 = { caucasian: 0.55, african: 0.17, asian: 0.28 };         // Konkan / east

const M = 'young_caucasian_male', MO = 'middleage_caucasian_male', MOLD = 'old_caucasian_male';
const F = 'cutoff3d_indian_female_skin', FO = 'middleage_caucasian_female', FOLD = 'old_caucasian_female';

function person(id, sex, years, heightCm, build, o) {
  const muscle = { slim: 0.42, average: 0.5, fit: 0.62, muscular: 0.72, heavy: 0.45, stocky: 0.58, lanky: 0.45 }[build];
  const weight = { slim: 0.32, average: 0.5, fit: 0.48, muscular: 0.55, heavy: 0.85, stocky: 0.68, lanky: 0.3 }[build];
  return {
    id, sex, ageYears: years, heightCm, build,
    macro: { age: ageMacro(years), muscle, weight, proportions: years < 16 ? 0.5 : 0.6, race: SA, ...(o.macro || {}) },
    targets: o.targets || {}, skin: o.skin || (sex === 'm' ? (years > 58 ? MOLD : years > 36 ? MO : M) : years > 58 ? FOLD : years > 38 ? FO : F),
    eyeColor: o.eyeColor || 'mindfront_brown_eye_02', eyebrows: o.eyebrows || (sex === 'm' ? 'eyebrow001' : 'eyebrow010'), eyelashes: o.eyelashes || (sex === 'm' ? 'eyelashes01' : 'eyelashes02'),
    hair: o.hair, clothes: o.clothes, kinds: o.kinds, palette: o.palette || {},
  };
}

export const POPULATION = [
  // --- men
  person('m_office_1', 'm', 34, 167, 'average', {
    macro: { race: SA }, targets: { 'nose-width1-incr': 0.3, 'mouth-lowerlip-volume-incr': 0.3, 'chin-width-incr': 0.2 },
    hair: 'short02', kinds: ['office', 'casual', 'police', 'trafficCop', 'driver'],
    clothes: [['top', 'elvs_male_shirt_untucked_bd1'], ['bottom', 'mindfront_male_trousers_1'], ['shoes', 'mindfront_shoes_oxford_male']],
  }),
  person('m_office_2', 'm', 45, 165, 'heavy', {
    macro: { race: SA2 }, targets: { 'nose-scale-horiz-incr': 0.3, 'head-fat-incr': 0.4, 'neck-double-incr': 0.4 },
    hair: 'short04', kinds: ['office', 'casual', 'police'],
    clothes: [['top', 'ews_striped_shirt', { tint: false }], ['bottom', 'elvs_male_trouser'], ['shoes', 'mindfront_shoes_monk_strap_male']],
  }),
  person('m_office_3', 'm', 29, 171, 'slim', {
    macro: { race: SA3 }, targets: { 'nose-hump-incr': 0.4, 'chin-prominent-incr': 0.3 },
    hair: 'short03', kinds: ['office', 'casual', 'trafficCop'],
    clothes: [['top', 'elvs_male_shirt_tie_tucked1'], ['bottom', 'mindfront_male_trousers_2'], ['shoes', 'mindfront_shoes_oxford_male']],
  }),
  person('m_casual_1', 'm', 22, 169, 'slim', {
    macro: { race: SA }, targets: { 'mouth-scale-horiz-incr': 0.2 },
    hair: 'cortu_short_messy_hair', kinds: ['casual', 'jogger'],
    clothes: [['top', 'elvs_crude_t-shirt_male'], ['bottom', 'punkduck_male_classic_jeans', { tint: false }], ['shoes', 'punkduck_comfortable_sneakers']],
  }),
  person('m_casual_2', 'm', 26, 172, 'fit', {
    macro: { race: SA4 }, targets: { 'nose-nostrils-width-incr': 0.4, 'head-square': 0.3 },
    hair: 'short02', kinds: ['casual', 'jogger', 'police'],
    clothes: [['top', 'namuhekam_male_polo_shirt'], ['bottom', 'punkduck_male_classic_jeans', { tint: false }], ['shoes', 'punkduck_running_shoes_01'], ['facial', 'wdg_scruffy_beard']],
  }),
  person('m_casual_3', 'm', 38, 166, 'stocky', {
    macro: { race: SA2 }, targets: { 'nose-scale-horiz-incr': 0.4, 'mouth-upperlip-volume-incr': 0.3 },
    hair: 'short01', kinds: ['casual', 'office', 'driver', 'khaki'],
    clothes: [['top', 'elvs_male_shirt_untucked_bd1'], ['bottom', 'toigo_wool_pants'], ['shoes', 'dressupdoc_sandals1']],
  }),
  person('m_worker_1', 'm', 30, 163, 'slim', {
    macro: { race: SA2 }, targets: { 'l-cheek-bones-incr': 0.3, 'r-cheek-bones-incr': 0.3, 'head-oval': 0.3 },
    hair: 'short01', kinds: ['worker', 'casual', 'khaki', 'driver'],
    clothes: [['top', 'elvs_male_athletic_tank1'], ['bottom', 'cortu_cargo_pants'], ['shoes', 'elvs_male_flip_flop_sandals1']],
  }),
  person('m_worker_2', 'm', 33, 168, 'muscular', {
    macro: { race: SA }, targets: { 'chin-width-incr': 0.4, 'neck-scale-horiz-incr': 0.3 },
    hair: 'short03', kinds: ['worker', 'casual', 'police'],
    clothes: [['top', 'elvs_male_muscle_shirt1'], ['bottom', 'toigo_harem_pants'], ['shoes', 'elvs_male_flip_flop_sandals1'], ['facial', 'elvs_scruffy_beard1']],
  }),
  person('m_worker_3', 'm', 48, 162, 'slim', {
    macro: { race: SA2 }, targets: { 'head-age-incr': 0.3, 'nose-hump-incr': 0.3 },
    hair: 'short04', kinds: ['worker', 'khaki', 'driver', 'casual'],
    clothes: [['top', 'elvs_male_shirt_untucked_bd1'], ['bottom', 'cortu_cargo_pants'], ['shoes', 'elvs_male_flip_flop_sandals1']],
  }),
  person('m_old_1', 'm', 67, 163, 'slim', {
    macro: { race: SA3 }, targets: { 'head-age-incr': 0.6, 'nose-point-down': 0.3 },
    hair: 'short04', kinds: ['office', 'casual'], palette: { hair: 'grey' },
    clothes: [['top', 'elvs_male_shirt_untucked_bd1'], ['bottom', 'toigo_wool_pants'], ['shoes', 'dressupdoc_sandals1'], ['accessory', 'kwnet_at_optical_glasses', { tint: false }]],
  }),
  person('m_old_2', 'm', 74, 160, 'heavy', {
    macro: { race: SA }, targets: { 'head-age-incr': 0.8, 'neck-double-incr': 0.5 },
    hair: 'short02', kinds: ['casual', 'office'], palette: { hair: 'white' },
    clothes: [['top', 'elvs_male_shirt_untucked_bd1'], ['bottom', 'elvs_male_trouser'], ['shoes', 'elvs_male_flip_flop_sandals1'], ['accessory', 'frankyaye_glasses_library_male', { tint: false }]],
  }),
  person('m_teen_1', 'm', 15, 161, 'slim', {
    macro: { race: SA, proportions: 0.5 }, targets: {},
    hair: 'short03', kinds: ['casual', 'kid', 'jogger'],
    clothes: [['top', 'elvs_crude_t-shirt_male'], ['bottom', 'cortu_jeans_shorts', { tint: false }], ['shoes', 'culturalibre_sneakers']],
  }),
  // --- women
  person('f_young_1', 'f', 22, 156, 'slim', {
    macro: { race: SA, cupsize: 0.5 }, targets: { 'nose-scale-horiz-decr': 0.2 },
    hair: 'ponytail01', kinds: ['sari', 'casual', 'jogger'],
    clothes: [['top', 'joepal_crude_t-shirt_female'], ['bottom', 'punkduck_female_tight_jeans', { tint: false }], ['shoes', 'elvs_flatshoe_plain1']],
  }),
  person('f_young_2', 'f', 25, 154, 'average', {
    macro: { race: SA2 }, targets: { 'mouth-lowerlip-volume-incr': 0.3 },
    hair: 'braid01', kinds: ['sari', 'casual'],
    clothes: [['top', 'toigo_basic_tucked_t-shirt'], ['bottom', 'toigo_long_full_skirt'], ['shoes', 'elvs_flatshoe_plain1']],
  }),
  person('f_office_1', 'f', 31, 157, 'average', {
    macro: { race: SA3 }, targets: { 'nose-hump-incr': 0.2, 'chin-prominent-incr': 0.2 },
    hair: 'rehmanpolanski_hair_bun_brown', kinds: ['sari', 'office'],
    clothes: [['top', 'elvs_ruffle_sleeve_peasant_blouse_1'], ['bottom', 'mindfront_female_trousers_1'], ['shoes', 'toigo_flats']],
  }),
  person('f_mid_1', 'f', 42, 152, 'heavy', {
    macro: { race: SA2, cupsize: 0.6 }, targets: { 'head-fat-incr': 0.3 },
    hair: 'elvs_braid_bun', kinds: ['sari'],
    clothes: [['top', 'elvs_ruffle_sleeve_peasant_blouse_1'], ['bottom', 'toigo_harem_pants'], ['shoes', 'dressupdoc_sandals1']],
  }),
  person('f_mid_2', 'f', 36, 153, 'average', {
    macro: { race: SA4 }, targets: { 'nose-scale-horiz-incr': 0.2 },
    hair: 'braid01', kinds: ['sari', 'office'],
    clothes: [['top', 'drednicolson_asymmetric_tunic_and_sash'], ['bottom', 'elvs_gored_elephant_pants'], ['shoes', 'dressupdoc_sandals1']],
  }),
  person('f_old_1', 'f', 62, 150, 'heavy', {
    macro: { race: SA }, targets: { 'head-age-incr': 0.5 }, palette: { hair: 'grey' },
    hair: 'rehmanpolanski_hair_bun_brown', kinds: ['sari'],
    clothes: [['top', 'punkduck_v_neck_top'], ['bottom', 'toigo_long_full_skirt'], ['shoes', 'dressupdoc_sandals1']],
  }),
  person('f_old_2', 'f', 71, 148, 'slim', {
    macro: { race: SA2 }, targets: { 'head-age-incr': 0.7 }, palette: { hair: 'white' },
    hair: 'elvs_braid_bun', kinds: ['sari'],
    clothes: [['top', 'elvs_ruffle_sleeve_peasant_blouse_1'], ['bottom', 'toigo_long_full_skirt'], ['shoes', 'elvs_flatshoe_plain1'], ['accessory', 'kwnet_at_optical_glasses', { tint: false }]],
  }),
  person('f_young_3', 'f', 20, 158, 'slim', {
    macro: { race: SA3 }, targets: {},
    hair: 'long01', kinds: ['sari', 'casual', 'jogger'],
    clothes: [['top', 'elvs_ladies_tank1'], ['bottom', 'elvs_jeans_straight_leg', { tint: false }], ['shoes', 'punkduck_tennis_shoes']],
  }),
  person('f_young_4', 'f', 27, 155, 'average', {
    macro: { race: SA }, targets: { 'mouth-scale-horiz-decr': 0.2 },
    hair: 'ponytail01', kinds: ['sari', 'office', 'police'],
    clothes: [['top', 'punkduck_v_neck_top'], ['bottom', 'toigo_wool_pants'], ['shoes', 'toigo_flats']],
  }),
  person('f_teen_1', 'f', 15, 153, 'slim', {
    macro: { race: SA, proportions: 0.5, cupsize: 0.3 }, targets: {},
    hair: 'elvs_double_mh_braid', kinds: ['sari', 'kid'],
    clothes: [['top', 'toigo_basic_tucked_t-shirt'], ['bottom', 'toigo_tiered_skirt'], ['shoes', 'dressupdoc_maryjane1']],
  }),
  // --- children
  person('k_boy_1', 'm', 9, 131, 'average', {
    macro: { race: SA }, targets: {},
    hair: 'short03', kinds: ['kid'],
    clothes: [['top', 'elvs_crude_t-shirt_male'], ['bottom', 'cortu_jeans_shorts', { tint: false }], ['shoes', 'culturalibre_sneakers']],
  }),
  person('k_girl_1', 'f', 8, 126, 'average', {
    macro: { race: SA2 }, targets: {},
    hair: 'elvs_double_mh_braid', kinds: ['kid'],
    clothes: [['top', 'joepal_crude_t-shirt_female'], ['bottom', 'frankyaye_mini_skirt_01'], ['shoes', 'dressupdoc_maryjane1']],
  }),
];
