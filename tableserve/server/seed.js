// Demo data: two independent restaurant companies (both have a "Table 5"), platform admins,
// plans, and ~2 weeks of sales history. Everything is clearly labelled [DEMO].
//   node server/seed.js --reset     wipe the database file and seed
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { loadConfig } from './app.js';
import { hashPassword, randomToken } from './util.js';

export const DEMO_PASSWORD = 'Demo@1234';

const rupees = (n) => Math.round(n * 100);
const portion = (half, full) => [{ id: 'portion', name: 'Portion', name_hi: 'मात्रा', type: 'single', required: true, choices: [
  { id: 'half', name: 'Half', name_hi: 'हाफ', price: rupees(half), in_stock: true },
  { id: 'full', name: 'Full', name_hi: 'फुल', price: rupees(full), in_stock: true }] }];
const size = (small, large) => ({ id: 'size', name: 'Size', name_hi: 'साइज़', type: 'single', required: true, choices: [
  { id: 'small', name: 'Small', name_hi: 'छोटा', price: rupees(small), in_stock: true },
  { id: 'large', name: 'Large', name_hi: 'बड़ा', price: rupees(large), in_stock: true }] });
const addons = (list) => ({ id: 'addons', name: 'Add-ons', name_hi: 'ऐड-ऑन', type: 'multi', required: false, max: list.length, choices: list.map(([id, name, name_hi, price]) => ({ id, name, name_hi, price: rupees(price), in_stock: true })) });

const SPICE_MENU = [
  ['Starters', 'स्टार्टर्स', [
    { name: 'Paneer Tikka', name_hi: 'पनीर टिक्का', price: 0, diet: 'veg', description: 'Cottage cheese cubes marinated in yoghurt and spices, chargrilled in the tandoor.', description_hi: 'दही और मसालों में मैरीनेट किया हुआ पनीर, तंदूर में सेंका हुआ।', ingredients: 'Paneer, yoghurt, bell pepper, onion, chilli, gram flour', allergens: ['dairy'], spice_level: 2, taste_notes: 'Smoky, tangy, medium spicy', portion_size: '6 / 10 pieces', options: [...portion(240, 380), addons([['mint', 'Extra mint chutney', 'एक्स्ट्रा पुदीना चटनी', 20], ['cheese', 'Extra cheese', 'एक्स्ट्रा चीज़', 50]])], is_popular: 1, prep_minutes: 15, emoji: '🧀' },
    { name: 'Chicken Malai Tikka', name_hi: 'चिकन मलाई टिक्का', price: rupees(320), diet: 'nonveg', description: 'Creamy, mildly spiced chicken kebabs with cashew and cheese marinade.', description_hi: 'काजू और चीज़ में मैरीनेट किए हुए मलाईदार चिकन कबाब।', ingredients: 'Chicken, cream, cashew, cheese, cardamom', allergens: ['dairy', 'nuts'], spice_level: 1, taste_notes: 'Rich, creamy, mild', portion_size: '8 pieces', is_special: 1, prep_minutes: 20, emoji: '🍗' },
    { name: 'Hara Bhara Kebab', name_hi: 'हरा भरा कबाब', price: rupees(210), diet: 'vegan', description: 'Spinach, peas and potato patties, shallow fried.', description_hi: 'पालक, मटर और आलू की टिक्की।', ingredients: 'Spinach, green peas, potato, green chilli', allergens: [], spice_level: 1, taste_notes: 'Herby, mild', portion_size: '6 pieces', prep_minutes: 12, emoji: '🥬' },
  ]],
  ['Main Course', 'मुख्य व्यंजन', [
    { name: 'Dal Makhani', name_hi: 'दाल मखनी', price: 0, diet: 'veg', description: 'Black lentils slow-cooked overnight with butter and cream.', description_hi: 'मक्खन और क्रीम के साथ रात भर पकी काली दाल।', ingredients: 'Black urad, kidney beans, butter, cream, tomato', allergens: ['dairy'], spice_level: 1, taste_notes: 'Buttery, smoky, mild', portion_size: 'Half 300ml / Full 500ml', options: portion(220, 340), is_popular: 1, prep_minutes: 10, emoji: '🍲' },
    { name: 'Butter Chicken', name_hi: 'बटर चिकन', price: 0, diet: 'nonveg', description: 'Tandoori chicken simmered in a velvety tomato-butter gravy.', description_hi: 'टमाटर-मक्खन की ग्रेवी में पका तंदूरी चिकन।', ingredients: 'Chicken, tomato, butter, cream, fenugreek, cashew', allergens: ['dairy', 'nuts'], spice_level: 1, taste_notes: 'Sweet-savoury, creamy', portion_size: 'Half / Full', options: [...portion(290, 460), addons([['butter', 'Extra butter', 'एक्स्ट्रा मक्खन', 30]])], is_popular: 1, prep_minutes: 18, emoji: '🍛' },
    { name: 'Kadai Paneer', name_hi: 'कड़ाही पनीर', price: rupees(310), diet: 'veg', description: 'Paneer tossed with capsicum and onion in freshly ground kadai masala.', description_hi: 'शिमला मिर्च और प्याज़ के साथ कड़ाही मसाले में पनीर।', ingredients: 'Paneer, capsicum, onion, tomato, coriander seed', allergens: ['dairy'], spice_level: 3, taste_notes: 'Bold, hot, aromatic', portion_size: 'Serves 2', prep_minutes: 15, emoji: '🌶️' },
    { name: 'Egg Curry', name_hi: 'अंडा करी', price: rupees(220), diet: 'egg', description: 'Boiled eggs in a homestyle onion-tomato gravy.', description_hi: 'घर जैसी प्याज़-टमाटर ग्रेवी में उबले अंडे।', ingredients: 'Egg, onion, tomato, ginger, garlic', allergens: ['egg'], spice_level: 2, taste_notes: 'Homestyle, medium spicy', portion_size: '2 eggs', prep_minutes: 12, emoji: '🥚' },
  ]],
  ['Breads & Rice', 'रोटी और चावल', [
    { name: 'Butter Naan', name_hi: 'बटर नान', price: rupees(60), diet: 'veg', description: 'Soft leavened bread from the tandoor, brushed with butter.', description_hi: 'तंदूर की मुलायम नान, मक्खन के साथ।', ingredients: 'Refined flour, yoghurt, butter', allergens: ['gluten', 'dairy'], spice_level: 0, taste_notes: 'Soft, buttery', options: [addons([['garlic', 'Garlic', 'लहसुन', 15], ['cheese', 'Cheese stuffing', 'चीज़ भराई', 40]])], prep_minutes: 8, emoji: '🫓' },
    { name: 'Veg Dum Biryani', name_hi: 'वेज दम बिरयानी', price: rupees(280), diet: 'veg', description: 'Fragrant basmati layered with vegetables and slow-cooked on dum. Served with raita.', description_hi: 'सब्ज़ियों के साथ दम पर पकी खुशबूदार बासमती। रायते के साथ।', ingredients: 'Basmati rice, vegetables, saffron, fried onion, mint', allergens: ['dairy'], spice_level: 2, taste_notes: 'Aromatic, layered spice', portion_size: 'Serves 1–2', prep_minutes: 20, emoji: '🍚' },
  ]],
  ['Combos & Specials', 'कॉम्बो और स्पेशल', [
    { name: 'Thali for One', name_hi: 'एक व्यक्ति की थाली', price: rupees(399), diet: 'veg', description: 'Dal makhani, paneer of the day, seasonal sabzi, rice, 2 naan, raita, salad and gulab jamun.', description_hi: 'दाल मखनी, पनीर, मौसमी सब्ज़ी, चावल, 2 नान, रायता, सलाद और गुलाब जामुन।', ingredients: 'See description', allergens: ['dairy', 'gluten'], spice_level: 1, taste_notes: 'A bit of everything', is_combo: 1, combo_details: 'Dal • Paneer • Sabzi • Rice • 2 Naan • Raita • Dessert', is_special: 1, prep_minutes: 15, emoji: '🍱' },
  ]],
  ['Drinks & Desserts', 'पेय और मिठाई', [
    { name: 'Masala Chaas', name_hi: 'मसाला छाछ', price: rupees(70), diet: 'veg', description: 'Spiced buttermilk with roasted cumin and mint.', description_hi: 'भुने जीरे और पुदीने वाली छाछ।', ingredients: 'Yoghurt, cumin, mint, ginger', allergens: ['dairy'], spice_level: 0, taste_notes: 'Cooling, tangy', prep_minutes: 3, emoji: '🥛' },
    { name: 'Mango Lassi', name_hi: 'आम लस्सी', price: 0, diet: 'veg', description: 'Thick yoghurt smoothie with Alphonso mango pulp.', description_hi: 'अल्फांसो आम के साथ गाढ़ी लस्सी।', ingredients: 'Yoghurt, mango, sugar', allergens: ['dairy'], spice_level: 0, taste_notes: 'Sweet, creamy', options: [size(120, 170)], prep_minutes: 4, emoji: '🥭' },
    { name: 'Gulab Jamun', name_hi: 'गुलाब जामुन', price: rupees(90), diet: 'veg', description: 'Warm milk dumplings in rose-cardamom syrup.', description_hi: 'गुलाब-इलायची चाशनी में गरम गुलाब जामुन।', ingredients: 'Khoya, flour, sugar, cardamom', allergens: ['dairy', 'gluten'], spice_level: 0, taste_notes: 'Very sweet', portion_size: '2 pieces', prep_minutes: 3, in_stock: 0, emoji: '🍮' },
  ]],
];

const COASTAL_MENU = [
  ['Tiffin', 'टिफ़िन', [
    { name: 'Masala Dosa', name_hi: 'मसाला डोसा', price: rupees(140), diet: 'vegan', description: 'Crisp rice-lentil crêpe with spiced potato, sambar and chutneys.', description_hi: 'मसालेदार आलू, सांभर और चटनी के साथ कुरकुरा डोसा।', ingredients: 'Rice, urad dal, potato, mustard seed, curry leaf', allergens: ['mustard'], spice_level: 1, taste_notes: 'Crisp, tangy', options: [addons([['ghee', 'Ghee roast', 'घी रोस्ट', 30], ['cheese', 'Extra cheese', 'एक्स्ट्रा चीज़', 40]])], is_popular: 1, prep_minutes: 10, emoji: '🥞' },
    { name: 'Idli Sambar', name_hi: 'इडली सांभर', price: rupees(90), diet: 'vegan', description: 'Steamed rice cakes with sambar and coconut chutney.', description_hi: 'सांभर और नारियल चटनी के साथ इडली।', ingredients: 'Rice, urad dal, lentils, coconut', allergens: [], spice_level: 1, taste_notes: 'Light, comforting', portion_size: '3 pieces', prep_minutes: 6, emoji: '⚪' },
  ]],
  ['Seafood', 'सीफ़ूड', [
    { name: 'Prawn Gassi', name_hi: 'झींगा गस्सी', price: 0, diet: 'nonveg', description: 'Mangalorean prawn curry with coconut and byadgi chilli.', description_hi: 'नारियल और ब्याडगी मिर्च वाली मैंगलोरियन झींगा करी।', ingredients: 'Prawns, coconut, tamarind, byadgi chilli', allergens: ['shellfish'], spice_level: 3, taste_notes: 'Fiery, coconutty, tangy', options: portion(380, 620), is_special: 1, prep_minutes: 20, emoji: '🦐' },
    { name: 'Fish Fry (Rava)', name_hi: 'रवा फिश फ्राई', price: rupees(360), diet: 'nonveg', description: 'Seer fish coated in semolina and spices, pan fried.', description_hi: 'सूजी और मसालों में लिपटी सुरमई मछली।', ingredients: 'Seer fish, semolina, chilli, turmeric', allergens: ['fish', 'gluten'], spice_level: 2, taste_notes: 'Crunchy, spicy', portion_size: '2 slices', is_popular: 1, prep_minutes: 15, emoji: '🐟' },
  ]],
  ['Rice & Curries', 'चावल और करी', [
    { name: 'Veg Stew & Appam', name_hi: 'वेज स्टू और अप्पम', price: rupees(240), diet: 'vegan', description: 'Kerala coconut milk stew with lacy appams.', description_hi: 'नारियल दूध का केरल स्टू, अप्पम के साथ।', ingredients: 'Coconut milk, vegetables, rice', allergens: [], spice_level: 0, taste_notes: 'Mild, fragrant', is_combo: 1, combo_details: 'Stew + 2 Appams', prep_minutes: 14, emoji: '🥥' },
    { name: 'Curd Rice', name_hi: 'दही चावल', price: rupees(120), diet: 'veg', description: 'Tempered yoghurt rice with pomegranate.', description_hi: 'छौंक लगा दही चावल।', ingredients: 'Rice, yoghurt, mustard seed, curry leaf', allergens: ['dairy', 'mustard'], spice_level: 0, taste_notes: 'Cooling', prep_minutes: 5, emoji: '🍚' },
  ]],
  ['Beverages', 'पेय', [
    { name: 'Filter Coffee', name_hi: 'फ़िल्टर कॉफ़ी', price: 0, diet: 'veg', description: 'Strong decoction with frothy milk, served in a davara.', description_hi: 'झागदार दूध के साथ कड़क फ़िल्टर कॉफ़ी।', ingredients: 'Coffee, chicory, milk, sugar', allergens: ['dairy'], spice_level: 0, taste_notes: 'Strong, bittersweet', options: [size(50, 80)], prep_minutes: 4, emoji: '☕' },
    { name: 'Tender Coconut', name_hi: 'नारियल पानी', price: rupees(80), diet: 'vegan', description: 'Fresh tender coconut water.', description_hi: 'ताज़ा नारियल पानी।', ingredients: 'Coconut water', allergens: [], spice_level: 0, taste_notes: 'Refreshing', prep_minutes: 2, emoji: '🥥' },
  ]],
];

// Simple placeholder image (SVG data URL) so the demo works offline.
function emojiImage(emoji, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" rx="0" fill="${color}"/><text x="80" y="78" font-size="56" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function seed(db) {
  const pw = hashPassword(DEMO_PASSWORD);
  const user = (email, name, extra = {}) => db.run(
    'INSERT INTO users (email, password_hash, name, platform_role, platform_perms) VALUES (?,?,?,?,?)',
    email, pw, name, extra.platform_role ?? null, JSON.stringify(extra.perms ?? [])).lastId;

  return db.tx(() => {
    user('super@tableserve.demo', '[DEMO] Super Admin', { platform_role: 'super_admin' });
    user('support@tableserve.demo', '[DEMO] Platform Support', { platform_role: 'platform_admin', perms: ['companies.view', 'onboarding', 'support'] });

    const plan = (name, m, a, br, tb, st) => db.run('INSERT INTO plans (name, price_monthly, price_annual, max_branches, max_tables, max_staff, trial_days) VALUES (?,?,?,?,?,?,14)', name, rupees(m), rupees(a), br, tb, st).lastId;
    const starter = plan('Starter', 999, 9990, 1, 15, 8);
    const growth = plan('Growth', 2499, 24990, 3, 60, 30);
    plan('Enterprise', 5999, 59990, 20, 500, 200);

    const out = {};
    const companies = [
      {
        key: 'spice', name: '[DEMO] Spice Garden', slug: 'demo-spice-garden', color: '#d9480f', plan: growth, sub: 'active', prefix: 'spicegarden',
        description: 'North Indian kitchen & tandoor. Demo company A.', phone: '+91 80 4000 1111', address: '12 Demo Road, Koramangala, Bengaluru',
        payments: { cash: true, pay_at_counter: true, upi: true, upi_vpa: 'spicegarden@okdemo', upi_payee: 'Spice Garden (DEMO)', online: true, online_provider: 'test' },
        service: 5, menu: SPICE_MENU,
        branches: [
          { name: 'Koramangala', tables: 8, selfStart: 1, qr5: 'demo-spice-kor-t5' },
          { name: 'Indiranagar', tables: 6, selfStart: 0, qr5: 'demo-spice-ind-t5' },
        ],
      },
      {
        key: 'coastal', name: '[DEMO] Coastal Curry Co.', slug: 'demo-coastal-curry', color: '#0b7285', plan: starter, sub: 'trial', prefix: 'coastalcurry',
        description: 'Konkan & Kerala coastal food. Demo company B.', phone: '+91 22 4000 2222', address: '5 Demo Lane, Bandra West, Mumbai',
        payments: { cash: true, pay_at_counter: true, upi: false, online: true, online_provider: 'test' },
        service: 0, menu: COASTAL_MENU,
        branches: [{ name: 'Bandra', tables: 6, selfStart: 0, qr5: 'demo-coastal-ban-t5' }],
      },
    ];

    for (const c of companies) {
      const cid = db.run(`INSERT INTO companies (name, slug, description, phone, email, address, opening_hours, brand_color, currency, languages, ordering_mode, taxes, service_charge_pct,
          payment_settings, plan_id, subscription_status, trial_ends_at, current_period_end, is_demo)
        VALUES (?,?,?,?,?,?,?,?,'INR','["en","hi"]','ordering',?,?,?,?,?,?,?,1)`,
      c.name, c.slug, c.description, c.phone, `owner@${c.prefix}.demo`, c.address, 'Mon–Sun 11:00–23:00', c.color,
      JSON.stringify([{ name: 'CGST', rate: 2.5 }, { name: 'SGST', rate: 2.5 }]), c.service, JSON.stringify(c.payments), c.plan, c.sub,
      c.sub === 'trial' ? new Date(Date.now() + 10 * 864e5).toISOString() : null,
      c.sub === 'active' ? new Date(Date.now() + 20 * 864e5).toISOString() : null).lastId;
      const info = { id: cid, branches: [], users: {} };
      const member = (uid, role, branchIds) => {
        const mid = db.run('INSERT INTO company_members (company_id, user_id, role) VALUES (?,?,?)', cid, uid, role).lastId;
        for (const b of branchIds) db.run('INSERT INTO member_branches (member_id, branch_id) VALUES (?,?)', mid, b);
      };
      for (const b of c.branches) {
        const bid = db.run('INSERT INTO branches (company_id, name, address, phone, opening_hours, self_start_sessions) VALUES (?,?,?,?,?,?)',
          cid, b.name, `${b.name} (demo address)`, c.phone, 'Mon–Sun 11:00–23:00', b.selfStart).lastId;
        const tables = [];
        for (let n = 1; n <= b.tables; n++) {
          const token = n === 5 ? b.qr5 : randomToken(12);
          tables.push(db.run('INSERT INTO tables (company_id, branch_id, number, capacity, section, qr_token) VALUES (?,?,?,?,?,?)',
            cid, bid, String(n), n % 3 === 0 ? 6 : n % 2 ? 2 : 4, n <= Math.ceil(b.tables / 2) ? 'Indoor' : 'Terrace', token).lastId);
        }
        const items = [];
        c.menu.forEach(([cat, catHi, dishes], ci) => {
          const catId = db.run('INSERT INTO categories (company_id, branch_id, name, name_hi, sort) VALUES (?,?,?,?,?)', cid, bid, cat, catHi, ci).lastId;
          dishes.forEach((d, di) => {
            const id = db.run(`INSERT INTO menu_items (company_id, branch_id, category_id, name, name_hi, description, description_hi, price, image_url, portion_size, diet,
                ingredients, allergens, spice_level, taste_notes, options, is_popular, is_special, is_combo, combo_details, prep_minutes, in_stock, sort)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            cid, bid, catId, d.name, d.name_hi, d.description, d.description_hi, d.price, emojiImage(d.emoji, d.diet === 'nonveg' ? '#ffe3e3' : '#fff4e6'),
            d.portion_size || '', d.diet, d.ingredients, JSON.stringify(d.allergens), d.spice_level, d.taste_notes, JSON.stringify(d.options || []),
            d.is_popular || 0, d.is_special || 0, d.is_combo || 0, d.combo_details || '', d.prep_minutes, d.in_stock ?? 1, di).lastId;
            items.push({ id, ...d });
          });
        });
        info.branches.push({ id: bid, name: b.name, tables, table5: tables[4], qr5: b.qr5, items });
      }
      const allBranches = info.branches.map((b) => b.id);
      const first = [allBranches[0]];
      info.users.owner = user(`owner@${c.prefix}.demo`, `[DEMO] ${c.name.replace('[DEMO] ', '')} Owner`);
      member(info.users.owner, 'owner', []);
      info.users.manager = user(`manager@${c.prefix}.demo`, '[DEMO] Branch Manager');
      member(info.users.manager, 'admin', first);
      info.users.kitchen = user(`kitchen@${c.prefix}.demo`, '[DEMO] Kitchen');
      member(info.users.kitchen, 'kitchen', first);
      info.users.waiter = user(`waiter@${c.prefix}.demo`, '[DEMO] Waiter');
      member(info.users.waiter, 'waiter', first);
      info.users.cashier = user(`cashier@${c.prefix}.demo`, '[DEMO] Cashier');
      member(info.users.cashier, 'cashier', first);
      out[c.key] = info;
    }

    seedHistory(db, out.spice, out.spice.branches[0], 14, 6);
    seedHistory(db, out.spice, out.spice.branches[1], 14, 3);
    seedHistory(db, out.coastal, out.coastal.branches[0], 8, 3);

    // Platform subscription revenue history (separate from restaurant sales).
    db.run(`INSERT INTO subscription_payments (company_id, plan_id, period, amount, status, reference, created_at) VALUES (?,?, 'monthly', ?, 'paid', 'DEMO-INV-001', ?)`,
      out.spice.id, growth, rupees(2499), new Date(Date.now() - 10 * 864e5).toISOString());
    db.run(`INSERT INTO support_tickets (company_id, created_by, subject, priority) VALUES (?,?,?, 'normal')`, out.coastal.id, out.coastal.users.owner, '[DEMO] How do I print table QR codes?');
    db.run(`INSERT INTO support_messages (ticket_id, author_id, body) VALUES (last_insert_rowid(), ?, 'Where can I download the QR codes for all my tables at once?')`, out.coastal.users.owner);
    return out;
  });
}

// Generate closed, fully-paid dining sessions in the past so reports have data.
function seedHistory(db, company, branch, days, perDay) {
  let seq = 0;
  let billSeq = 0;
  const priceOf = (it) => {
    const opts = it.options || [];
    const first = opts.find((g) => g.required);
    return { unit: it.price + (first ? first.choices[first.choices.length - 1].price : 0), chosen: first ? [{ group: first.name, name: first.choices[first.choices.length - 1].name, price: first.choices[first.choices.length - 1].price }] : [] };
  };
  const sellable = branch.items.filter((i) => i.in_stock !== 0);
  let rnd = 7 + branch.id;
  const rand = (n) => { rnd = (rnd * 9301 + 49297) % 233280; return Math.floor((rnd / 233280) * n); };
  for (let d = days; d >= 1; d--) {
    for (let k = 0; k < perDay; k++) {
      const at = new Date(Date.now() - d * 864e5 + (12 + k) * 3600e3);
      const iso = at.toISOString();
      const table = branch.tables[rand(branch.tables.length)];
      const sid = db.run(`INSERT INTO dining_sessions (company_id, branch_id, table_id, join_code, status, opened_at, closed_at) VALUES (?,?,?,?, 'closed', ?, ?)`,
        company.id, branch.id, table, '0000', iso.replace('T', ' ').slice(0, 19), iso.replace('T', ' ').slice(0, 19)).lastId;
      const cancelled = rand(10) === 0;
      seq++;
      const lines = Array.from({ length: 1 + rand(3) }, () => sellable[rand(sellable.length)]);
      let subtotal = 0;
      const oid = db.run(`INSERT INTO orders (company_id, branch_id, table_id, session_id, order_no, idempotency_key, source, status, subtotal, created_at, accepted_at, served_at, cancelled_at, cancel_reason)
        VALUES (?,?,?,?,?,?, 'customer', ?, 0, ?, ?, ?, ?, ?)`, company.id, branch.id, table, sid, seq, `seed-${branch.id}-${seq}`, cancelled ? 'cancelled' : 'served', iso,
      cancelled ? null : iso, cancelled ? null : iso, cancelled ? iso : null, cancelled ? 'Customer left (demo)' : null).lastId;
      for (const it of lines) {
        const qty = 1 + rand(2);
        const { unit, chosen } = priceOf(it);
        subtotal += unit * qty;
        db.run('INSERT INTO order_items (order_id, menu_item_id, name, name_hi, diet, unit_price, options, qty, line_total) VALUES (?,?,?,?,?,?,?,?,?)',
          oid, it.id, it.name, it.name_hi, it.diet, unit, JSON.stringify(chosen), qty, unit * qty);
      }
      db.run('UPDATE orders SET subtotal = ? WHERE id = ?', subtotal, oid);
      if (cancelled) continue;
      billSeq++;
      const company_ = db.get('SELECT * FROM companies WHERE id = ?', company.id);
      const sc = Math.round(subtotal * company_.service_charge_pct / 100);
      const tax = Math.round((subtotal + sc) * 0.025) * 2;
      const total = subtotal + sc + tax;
      const bid = db.run(`INSERT INTO bills (company_id, branch_id, session_id, table_id, bill_no, subtotal, service_charge, taxes, tax_total, total, paid, status, created_at, paid_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?, 'paid', ?, ?)`, company.id, branch.id, sid, table, billSeq, subtotal, sc,
      JSON.stringify([{ name: 'CGST', rate: 2.5, amount: tax / 2 }, { name: 'SGST', rate: 2.5, amount: tax / 2 }]), tax, total, total, iso, iso).lastId;
      const method = ['cash', 'upi', 'online'][rand(3)];
      const pid = db.run(`INSERT INTO payments (company_id, branch_id, bill_id, method, amount, status, provider, provider_mode, initiated_by, created_at, confirmed_at, reference)
        VALUES (?,?,?,?,?, 'paid', ?, ?, ?, ?, ?, ?)`, company.id, branch.id, bid, method, total, method === 'online' ? 'test' : null, method === 'online' ? 'test' : null,
      method === 'online' ? 'customer' : 'staff', iso, iso, method === 'upi' ? `DEMO${100000 + seq}` : '').lastId;
      if (rand(15) === 0) {
        const amt = Math.round(total * 0.2);
        db.run(`INSERT INTO refunds (company_id, payment_id, amount, reason, created_by, created_at) VALUES (?,?,?,?,?,?)`, company.id, pid, amt, 'Dish returned (demo)', company.users.owner, iso);
        db.run('UPDATE payments SET refunded_amount = ? WHERE id = ?', amt, pid);
        db.run('UPDATE bills SET refunded = ? WHERE id = ?', amt, bid);
      }
    }
  }
  db.run('UPDATE branches SET order_seq = ?, bill_seq = ? WHERE id = ?', seq, billSeq, branch.id);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  if (process.argv.includes('--reset')) {
    for (const f of [config.databaseFile, `${config.databaseFile}-wal`, `${config.databaseFile}-shm`]) fs.rmSync(f, { force: true });
  }
  const db = openDb(config.databaseFile);
  if (db.get('SELECT COUNT(*) n FROM users').n > 0) {
    console.log('Database already has data. Run with --reset to wipe and re-seed.');
    process.exit(0);
  }
  seed(db);
  console.log(`Seeded demo data into ${config.databaseFile}`);
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log(`Table 5 (Spice Garden, Koramangala): ${config.appUrl}/t/demo-spice-kor-t5`);
  console.log(`Table 5 (Coastal Curry, Bandra):     ${config.appUrl}/t/demo-coastal-ban-t5`);
}
