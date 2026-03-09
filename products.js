/* ═══════════════════════════════════════════════════
   products.js  –  Napoli's Pizza shared product store
   Uses localStorage so changes made in manage-products.html
   are instantly reflected on pizzaindex.html
═══════════════════════════════════════════════════ */

const PRODUCTS_KEY = 'reijo_products';

// ─── Default catalogue ────────────────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  {
    id: 'p001', name: 'Margherita', category: 'pizza',
    price: 12.99, badge: 'popular', icon: '🍕',
    colorClass: 'pizza-img-1', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Eq_it-na_pizza-margherita_sep2005_sml.jpg/250px-Eq_it-na_pizza-margherita_sep2005_sml.jpg',
    ingredients: ['tuore tomaatti','mozzarella','tuore basilika','oliiviöljy']
  },
  {
    id: 'p002', name: 'Pepperoni Inferno', category: 'pizza',
    price: 14.99, badge: 'spicy', icon: '🍕',
    colorClass: 'pizza-img-2', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/64/NYPizzaPie.jpg',
    ingredients: ['tupla pepperoni','tulinen nduja','mozzarella','chili hunajalla']
  },
  {
    id: 'p003', name: 'Tryffelisieni', category: 'pizza',
    price: 18.99, badge: 'new', icon: '🍕',
    colorClass: 'pizza-img-3', imageUrl: null,
    ingredients: ['musta tryffeli','villit sienet','taleggio','tuore timjami','pähkinä']
  },
  {
    id: 'p004', name: 'Neljän Juuston Pizza', category: 'pizza',
    price: 16.99, badge: null, icon: '🍕',
    colorClass: 'pizza-img-4', imageUrl: null,
    ingredients: ['mozzarella','gorgonzola','pecorino romano','ricotta','mustapippuri']
  },
  {
    id: 'p005', name: 'Kasvis Supreme', category: 'pizza',
    price: 13.99, badge: 'veg', icon: '🍕',
    colorClass: 'pizza-img-5', imageUrl: null,
    ingredients: ['paistettuja paprikaa','kesäkurpitsaa','munakoiso','aurinkokuivattua tomaattia','pesto pohja']
  },
  {
    id: 'p006', name: 'BBQ Kana', category: 'pizza',
    price: 15.99, badge: 'popular', icon: '🍕',
    colorClass: 'pizza-img-6', imageUrl: null,
    ingredients: ['savustettu BBQ kastike','revitty kana','punasipuli','jalapeno','cheddar']
  },
  {
    id: 'p007', name: 'Lihailijain Pizza', category: 'pizza',
    price: 17.99, badge: null, icon: '🍕',
    colorClass: 'pizza-img-7', imageUrl: null,
    ingredients: ['makkara','pekoni','prosciutto','salami','pepperoni','mozzarella']
  },
  {
    id: 'p008', name: 'Havaiji', category: 'pizza',
    price: 13.99, badge: null, icon: '🍕',
    colorClass: 'pizza-img-8', imageUrl: null,
    ingredients: ['tomaattikastike','mozzarella','prosciutto cotto','ananas','chili']
  },
  {
    id: 's001', name: 'Valkosipuli Pallerot', category: 'sides',
    price: 5.99, badge: null, icon: '🧄',
    colorClass: 'sides-img-1', imageUrl: null,
    ingredients: ['pehmeä taikina','paistettua valkosipulia voissa','tuore persilja','parmesaani (6 kpl)']
  },
  {
    id: 's002', name: 'Caesar Salaatti', category: 'sides',
    price: 7.99, badge: null, icon: '🥗',
    colorClass: 'sides-img-2', imageUrl: null,
    ingredients: ['cos salaatti','parmesaani', 'croutons','caesar dressing']
  },
  {
    id: 's003', name: 'Arancini (4 kpl)', category: 'sides',
    price: 8.99, badge: null, icon: '🍘',
    colorClass: 'sides-img-3', imageUrl: null,
    ingredients: ['rapea risotti','mozzarella sisällä','marinara kastike']
  },
  {
    id: 'd001', name: 'Tiramisu', category: 'desserts',
    price: 6.99, badge: 'popular', icon: '🍮',
    colorClass: 'dessert-img-1', imageUrl: null,
    ingredients: ['savoiardi keksit','espresso','mascarpone','kakaonjauhe']
  },
  {
    id: 'd002', name: 'Nutella Calzone', category: 'desserts',
    price: 7.99, badge: null, icon: '🍫',
    colorClass: 'dessert-img-2', imageUrl: null,
    ingredients: ['pizza taikina','Nutella täyte','sokeroitu jauhe']
  },
  {
    id: 'dr001', name: 'San Pellegrino', category: 'drinks',
    price: 2.99, badge: null, icon: '🥤',
    colorClass: 'drinks-img-1', imageUrl: null,
    ingredients: ['italialinen siiderillä mineraalivesi','330ml tölkki']
  },
  {
    id: 'dr002', name: 'Virvoitusjuomat', category: 'drinks',
    price: 2.49, badge: null, icon: '🥤',
    colorClass: 'drinks-img-2', imageUrl: null,
    ingredients: ['Coca-Cola','Coca-Cola Light','Limonadi','Fanta appelsiini','330ml tölkki']
  },
  {
    id: 'dr003', name: 'Kalja', category: 'drinks',
    price: 5.49, badge: null, icon: '🍺',
    colorClass: 'drinks-img-3', imageUrl: null,
    ingredients: ['paikallinen kalja','IPA','pale ale','330ml pullo']
  }
];

// ─── Ingredient library (employee can extend this) ─────────────────────
const INGREDIENTS_KEY = 'reijo_ingredients';

const DEFAULT_INGREDIENTS = {
  pizza: [
    'Tuore tomaatti','tomaattikastike','mozzarella',
    'tuore basilika','oliiviöljy','pepperoni','kebab','ranskalaiset',
    'majoneesi','herkkusieni','kananmuna','rucola',
    'gorgonzola','pecorino romano','ricotta','mustapippuri','paprika',
    'kesäkurpitsa','munakoiso','aurinkokuivattu tomaatti','pesto','BBQ Kastike',
    'revitty kana','punasipuli','jalapeno','cheddarjuusto','HK Sininen','pekoni',
    'aurinkokuivattua kinkkua','salaatti','salami','ananas','chili',
    'hunaja','tupla pepperoni','tupla kebab'
  ],
  sides: [
    'nugetit ja ranskalaiset','makkarakori','pelkät ranskalaiset','pussi mozzarellajuustoa',
  ],
  desserts: [
    'savoiardi keksit','espresso','mascarpone','kakaonjauhe',
    'pizza taikina','Nutella täyte','sokeroitu jauhe','vanilija jäätelö',
    'suklaakastike','karamelli','kerma','tuoreet mansikkat','sitruunakasvi'
  ],
  drinks: [
    'mineraalivesi','kylmä vesi','330ml tölkki','500ml pullo',
    'Coca-Cola','Coca-Cola Light','Limonadi','Fanta oranssi','paikallinen käsityöolut',
    'IPA','pale ale','330ml pullo','espresso','flat white','cappuccino',
    'appelsiinimehu','omenanmehu'
  ]
};

// ─── Public API ───────────────────────────────────────────────────────────

const ProductStore = {

  /** Load products (from localStorage, or seed defaults) */
  getAll() {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    this.saveAll(DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  },

  saveAll(products) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  add(product) {
    const products = this.getAll();
    product.id = 'p_' + Date.now();
    products.push(product);
    this.saveAll(products);
    return product;
  },

  update(id, updates) {
    const products = this.getAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates };
    this.saveAll(products);
    return products[idx];
  },

  remove(id) {
    const products = this.getAll().filter(p => p.id !== id);
    this.saveAll(products);
  },

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  getByCategory(cat) {
    return this.getAll().filter(p => p.category === cat);
  },

  /** Ingredient library */
  getIngredients() {
    try {
      const raw = localStorage.getItem(INGREDIENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(DEFAULT_INGREDIENTS));
    return DEFAULT_INGREDIENTS;
  },

  addIngredient(category, name) {
    const lib = this.getIngredients();
    if (!lib[category]) lib[category] = [];
    const normalised = name.trim().toLowerCase();
    if (!lib[category].find(i => i.toLowerCase() === normalised)) {
      lib[category].push(name.trim());
      localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(lib));
    }
  },

  /** Reset everything to defaults */
  reset() {
    this.saveAll(DEFAULT_PRODUCTS);
    localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(DEFAULT_INGREDIENTS));
  }
};
