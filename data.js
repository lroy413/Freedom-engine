/* FreeBound — the tables the app is built on.
   ============================================
   Reference data only: category lists, account and entity types, Schedule C
   line numbers, state tax rates and fees, icons, the default nav. No logic, no
   dependencies, nothing that reads `db`.

   It lives apart from index.html for two reasons. These are the things most
   often edited for reasons that have nothing to do with the app — a state
   changes its rate, the IRS moves a line number — and doing that inside nine
   thousand lines is how a stray keystroke takes down a page holding real money.
   And they are worth reading on their own.

   Loaded as a plain <script> BEFORE the app, not a module: a top-level const in
   a classic script joins the shared global lexical scope, so every name here is
   visible to index.html with no import and no build step. The order is
   load-bearing — index.html cannot resolve these names until this has run.

   Every rate here is a starting point, dated 2026, and editable in the app. */

/* "Gas" is ambiguous — Auto & Gas is the car, Gas (Utility) is the one that heats the place. */
const DEFAULT_RULES=[
      /* first match wins, so money moving between your own accounts is caught
         before "payment" or "deposit" can file it as spending or income */
      {m:"transfer",c:"Transfer"},{m:"xfer",c:"Transfer"},{m:"to savings",c:"Transfer"},
      {m:"from savings",c:"Transfer"},{m:"to checking",c:"Transfer"},{m:"from checking",c:"Transfer"},
      {m:"internal tra",c:"Transfer"},{m:"acct to acct",c:"Transfer"},{m:"online banking transfer",c:"Transfer"},
      {m:"netflix",c:"Subscriptions"},{m:"spotify",c:"Subscriptions"},{m:"hulu",c:"Subscriptions"},{m:"disney",c:"Subscriptions"},{m:"hbo",c:"Subscriptions"},{m:"adobe",c:"Subscriptions"},{m:"apple.com/bill",c:"Subscriptions"},
      {m:"geico",c:"Insurance"},{m:"progressive",c:"Insurance"},{m:"state farm",c:"Insurance"},{m:"insurance",c:"Insurance"},
      {m:"t-mobile",c:"Phone"},{m:"at&t",c:"Phone"},{m:"verizon",c:"Phone"},{m:"mint mobile",c:"Phone"},
      {m:"rent",c:"Rent/Mortgage"},{m:"apartment",c:"Rent/Mortgage"},{m:"property",c:"Rent/Mortgage"},
      {m:"shell",c:"Auto & Gas"},{m:"chevron",c:"Auto & Gas"},{m:"exxon",c:"Auto & Gas"},{m:"quiktrip",c:"Auto & Gas"},{m:"uber",c:"Auto & Gas"},{m:"lyft",c:"Auto & Gas"},
      {m:"kroger",c:"Food"},{m:"publix",c:"Food"},{m:"aldi",c:"Food"},{m:"whole foods",c:"Food"},{m:"trader joe",c:"Food"},{m:"grocery",c:"Food"},{m:"mcdonald",c:"Food"},{m:"chipotle",c:"Food"},{m:"doordash",c:"Food"},{m:"uber eats",c:"Food"},{m:"starbucks",c:"Food"},{m:"restaurant",c:"Food"},
      {m:"amazon",c:"Shopping"},{m:"target",c:"Shopping"},{m:"walmart",c:"Shopping"},
      {m:"steam",c:"Entertainment"},{m:"playstation",c:"Entertainment"},{m:"xbox",c:"Entertainment"},{m:"cinema",c:"Entertainment"},{m:"amc",c:"Entertainment"},{m:"ticketmaster",c:"Entertainment"},{m:"b&h",c:"Shopping"},{m:"adorama",c:"Shopping"},
      {m:"georgia power",c:"Electric"},{m:"ga power",c:"Electric"},{m:"electric",c:"Electric"},{m:"duke energy",c:"Electric"},
      {m:"gas south",c:"Gas (Utility)"},{m:"atlanta gas",c:"Gas (Utility)"},{m:"scana",c:"Gas (Utility)"},{m:"natural gas",c:"Gas (Utility)"},
      {m:"watershed",c:"Water"},{m:"water",c:"Water"},{m:"sewer",c:"Water"},
      {m:"waste management",c:"Trash"},{m:"republic services",c:"Trash"},{m:"sanitation",c:"Trash"},
      {m:"comcast",c:"Internet"},{m:"xfinity",c:"Internet"},{m:"google fiber",c:"Internet"},{m:"spectrum",c:"Internet"},{m:"internet",c:"Internet"},
      {m:"home depot",c:"Household"},{m:"lowes",c:"Household"},{m:"ikea",c:"Household"},
      {m:"overdraft",c:"Fees"},{m:"service charge",c:"Fees"},{m:"atm fee",c:"Fees"},{m:"late fee",c:"Fees"},
      {m:"payment",c:"Debt Payment"},{m:"autopay",c:"Debt Payment"},
      {m:"payroll",c:"Income"},{m:"direct dep",c:"Income"},{m:"deposit",c:"Income"}
    ];

/* "Food" covered the weekly shop and a Tuesday burrito equally, which is no
   use when Survive counts groceries and not eating out. Both exist now, and
   the everyday categories people actually reach for came with them. Food is
   kept, never removed — books already tagged with it must not be orphaned.
   normalize() adds anything new here to an existing book on next load. */
const DEFAULT_CATS=["Income","Rent/Mortgage","Electric","Gas (Utility)","Water","Trash","Internet","Phone",
  "Car Payment","Auto & Gas","Transit & Parking","Insurance","Subscriptions","Food","Groceries","Restaurants",
  "Coffee","Household","Home Maintenance","Shopping","Clothing","Health","Personal Care","Fitness","Pets",
  "Childcare","Education","Entertainment","Travel","Gifts","Charity","Gear",
  "Debt Payment","Savings","Transfer","Investment","Fees","Misc","Uncategorized"];

/* Two levels:
   HOLDERS (bank, credit union…) contain accounts and have no balance of their own.
   LEAVES (checking, savings, wallet, cash…) hold the actual money. */
const ACCT_KINDS={
  bank:{label:"Bank",group:"Bank accounts",color:"#0284c7",holder:true},
  creditunion:{label:"Credit union",group:"Bank accounts",color:"#4338ca",holder:true},
  institution:{label:"Other institution",group:"Other",color:"#565a66",holder:true},
  checking:{label:"Checking",group:"Bank accounts",color:"#0284c7"},
  savings:{label:"Savings",group:"Bank accounts",color:"#0ea5a0"},
  moneymarket:{label:"Money market",group:"Bank accounts",color:"#0e9c98"},
  cd:{label:"CD / term deposit",group:"Bank accounts",color:"#0891b2"},
  digital:{label:"Digital wallet",group:"Digital wallets",color:"#7c5cf0"},
  cash:{label:"Physical cash",group:"Cash",color:"#0ca35a"},
  /* Money in a brokerage or a 401(k) is yours, but it is not money you can
     spend on Thursday — and a bank sync files both as plain deposit accounts.
     Typed as their own kinds they stay out of cash, safe-to-spend and runway
     while still counting toward what you are worth. */
  brokerage:{label:"Brokerage",group:"Investments",color:"#7c5cf0",invest:true},
  crypto:{label:"Crypto",group:"Investments",color:"#a855f7",invest:true},
  r401k:{label:"401(k)",group:"Retirement",color:"#6366f1",invest:true,retire:true,pretax:true},
  r403b:{label:"403(b)",group:"Retirement",color:"#6366f1",invest:true,retire:true,pretax:true},
  ira:{label:"Traditional IRA",group:"Retirement",color:"#4f46e5",invest:true,retire:true,pretax:true},
  roth:{label:"Roth IRA",group:"Retirement",color:"#4338ca",invest:true,retire:true},
  sep:{label:"SEP / Solo 401(k)",group:"Retirement",color:"#4338ca",invest:true,retire:true,pretax:true},
  hsa:{label:"HSA",group:"Retirement",color:"#0891b2",invest:true,retire:true,pretax:true},
  pension:{label:"Pension",group:"Retirement",color:"#3730a3",invest:true,retire:true},
  credit:{label:"Credit card",group:"Cards & credit",color:"#dc2626",liability:true,revolving:true},
  lineofcredit:{label:"Line of credit",group:"Cards & credit",color:"#b91c1c",liability:true,revolving:true,debtKind:"loc"},
  autoloan:{label:"Auto loan",group:"Loans",color:"#ea580c",liability:true,installment:true,debtKind:"auto"},
  studentloan:{label:"Student loan",group:"Loans",color:"#d97706",liability:true,installment:true,debtKind:"student"},
  personalloan:{label:"Personal loan",group:"Loans",color:"#b45309",liability:true,installment:true,debtKind:"personal"},
  mortgage:{label:"Mortgage",group:"Loans",color:"#9a3412",liability:true,installment:true,debtKind:"mortgage"},
  other:{label:"Other account",group:"Other",color:"#565a66"}
};

const HOLDER_KINDS=Object.entries(ACCT_KINDS).filter(([,o])=>o.holder);

const LEAF_KINDS=Object.entries(ACCT_KINDS).filter(([,o])=>!o.holder);

const ACCT_GROUPS=["Bank accounts","Digital wallets","Cash","Investments","Retirement","Cards & credit","Loans","Other"];

/* Names a bank hands over for accounts that are not spendable. Only ever used to
   raise a question on the row, never to change a type behind your back. */
const INVEST_HINTS=/\b(401|403b|457|ira|roth|hsa|pension|annuity|brokerage|robinhood|vanguard|fidelity|schwab|etrade|e\*trade|betterment|wealthfront|coinbase|empower|primerica|tsp|sep|solo ?k|invest|crypto|securities)\b/i;

/* Money you move between your own accounts isn't income and isn't spending —
   it's the same dollars in a different pocket. Anything filed under Transfer is
   left out of every income, spending, budget and burn figure. */
const NEUTRAL_CATS=["Transfer","Investment"];

/* Banks name accounts for their own filing systems, not for reading in a list:
   "Navy Federal Credit Union EveryDay Checking - 9292 (9292)" wraps to two lines
   and says the same four digits twice. What a person actually needs is who it is
   with, what kind it is, and the last four. Display only — the stored name is
   whatever the bank sent, and the editor still shows it in full. */
const ACCT_FILLER=/\b(credit union|national association|federal savings|savings bank|bancorp|bank of america|n\.?a\.?|and trust|& trust|the)\b/gi;

const ACCT_TYPE=["Checking","Savings","Money Market","Brokerage","Mortgage","Loan","Card","IRA","CD"];

const CAT_GROUP={"Rent/Mortgage":"Housing",Rent:"Housing",Electric:"Utilities","Gas (Utility)":"Utilities",
  Water:"Utilities",Trash:"Utilities",Internet:"Utilities",Phone:"Utilities","Car Payment":"Transport",
  "Auto & Gas":"Transport","Transport/Gas":"Transport",Insurance:"Insurance","Debt Payment":"Debt",
  Subscriptions:"Subscriptions",Health:"Other",Household:"Other"};

const DEFAULT_TIER={Housing:"essential",Utilities:"essential",Insurance:"essential",Debt:"essential",
  Transport:"essential",Subscriptions:"luxury",Other:"flexible"};

/* Not every bill is monthly. A quarterly or annual bill needs two different
   numbers: what's actually due in a given month, and its true monthly cost. Mixing
   those up either overstates a month (car insurance billed once a year) or hides a
   real obligation (nothing shows for 11 months, then $600 lands). */
const BILL_FREQ={monthly:{n:1,label:"Monthly",every:"month"},bimonthly:{n:2,label:"Every 2 months",every:"2 months"},
  quarterly:{n:3,label:"Quarterly",every:"3 months"},semiannual:{n:6,label:"Twice a year",every:"6 months"},
  annual:{n:12,label:"Yearly",every:"year"}};

/* What kind of debt it is drives three things: whether it revolves (so utilization
   and a minimum payment apply), which spending category its payments belong to, and
   how it reads. "loan" from earlier versions maps to Personal loan. */
const DEBT_KINDS={
  card:{label:"Credit card",revolving:true,cat:"Debt Payment"},
  store:{label:"Store card",revolving:true,cat:"Debt Payment"},
  loc:{label:"Line of credit",revolving:true,cat:"Debt Payment"},
  collection:{label:"Collection",cat:"Debt Payment"},
  medical:{label:"Medical bill",cat:"Health"},
  auto:{label:"Auto loan",cat:"Car Payment"},
  student:{label:"Student loan",cat:"Debt Payment"},
  personal:{label:"Personal loan",cat:"Debt Payment"},
  mortgage:{label:"Mortgage",cat:"Rent/Mortgage"},
  tax:{label:"Tax debt",cat:"Debt Payment"},
  other:{label:"Other debt",cat:"Debt Payment"}
};

/* IRS Schedule C line items, so an export means something to an accountant. */
const SCHED_C={
  advertising:{line:"8",label:"Advertising"},
  car:{line:"9",label:"Car & truck"},
  commissions:{line:"10",label:"Commissions & fees"},
  contract:{line:"11",label:"Contract labor"},
  depletion:{line:"12",label:"Depletion"},
  depreciation:{line:"13",label:"Depreciation (gear)"},
  benefits:{line:"14",label:"Employee benefits"},
  bizinsurance:{line:"15",label:"Insurance (not health)"},
  interest:{line:"16b",label:"Interest"},
  legal:{line:"17",label:"Legal & professional"},
  office:{line:"18",label:"Office expense"},
  pension:{line:"19",label:"Pension & profit-sharing"},
  rentlease:{line:"20a",label:"Rent — equipment lease"},
  rentprop:{line:"20b",label:"Rent — other business property"},
  repairs:{line:"21",label:"Repairs & maintenance"},
  supplies:{line:"22",label:"Supplies"},
  taxeslic:{line:"23",label:"Taxes & licenses"},
  travel:{line:"24a",label:"Travel"},
  meals:{line:"24b",label:"Meals (50%)"},
  utilities:{line:"25",label:"Utilities"},
  wages:{line:"26",label:"Wages"},
  other:{line:"27a",label:"Other expenses"},
  /* Part III of Schedule C works out cost of goods sold and carries the answer
     to line 4, above the expense list — it comes off revenue, not out of it.
     Only a business that sells goods ever has one. */
  cogs:{line:"4",label:"Cost of goods sold",derived:true},
  /* the two biggest deductions a freelancer never logs as a transaction,
     because neither one is ever a card swipe */
  mileage:{line:"9",label:"Business miles",derived:true},
  homeoffice:{line:"30",label:"Home office",derived:true}
};

/* first guess only — every one of these is editable per transaction */
const CAT_TO_SCHED={"Auto & Gas":"car","Car Payment":"car",Insurance:"bizinsurance",Subscriptions:"office",
  Internet:"utilities",Phone:"utilities",Electric:"utilities","Gas (Utility)":"utilities",Water:"utilities",
  Shopping:"supplies",Household:"supplies",Entertainment:"meals",Food:"meals",Fees:"legal",
  "Rent/Mortgage":"rentprop",Misc:"other",Uncategorized:"other"};

const US_STATES={
  AL:{name:"Alabama",rate:5.0,note:"Some cities add an occupational tax."},
  AK:{name:"Alaska",rate:0,none:true},
  AZ:{name:"Arizona",rate:2.5,flat:true},
  AR:{name:"Arkansas",rate:3.9},
  CA:{name:"California",rate:9.3,fee:800,
    feeNote:"$800 minimum franchise tax every year, plus a gross-receipts fee over $250k — owed even in a year you make nothing."},
  CO:{name:"Colorado",rate:4.4,flat:true},
  CT:{name:"Connecticut",rate:5.5},
  DE:{name:"Delaware",rate:6.6,fee:300,
    feeNote:"$300 LLC annual tax. Forming here while working elsewhere usually means registering in both states, and paying both."},
  DC:{name:"District of Columbia",rate:8.5,
    note:"DC taxes unincorporated businesses directly (D-30) above $12k of gross receipts."},
  FL:{name:"Florida",rate:0,none:true},
  GA:{name:"Georgia",rate:5.39,flat:true,fee:50,feeNote:"$50 annual registration."},
  HI:{name:"Hawaii",rate:8.25,note:"General excise tax applies to gross receipts, on top of income tax."},
  ID:{name:"Idaho",rate:5.695,flat:true},
  IL:{name:"Illinois",rate:4.95,flat:true,fee:75,note:"A 1.5% personal property replacement tax applies to pass-throughs.",
    feeNote:"$75 annual report."},
  IN:{name:"Indiana",rate:3.0,flat:true,note:"Counties add their own rate on top."},
  IA:{name:"Iowa",rate:3.8,flat:true},
  KS:{name:"Kansas",rate:5.7},
  KY:{name:"Kentucky",rate:4.0,flat:true,note:"Many cities and counties add an occupational licence fee."},
  LA:{name:"Louisiana",rate:3.0,flat:true},
  ME:{name:"Maine",rate:7.15},
  MD:{name:"Maryland",rate:4.75,note:"Every county adds its own income tax — typically another 2.25–3.2%."},
  MA:{name:"Massachusetts",rate:5.0,fee:500,feeNote:"$500 LLC annual report — the steepest in the country."},
  MI:{name:"Michigan",rate:4.25,flat:true,note:"Some cities add a local income tax."},
  MN:{name:"Minnesota",rate:7.85},
  MS:{name:"Mississippi",rate:4.4,flat:true},
  MO:{name:"Missouri",rate:4.7,note:"Kansas City and St. Louis add a 1% earnings tax."},
  MT:{name:"Montana",rate:5.9},
  NE:{name:"Nebraska",rate:5.2},
  NV:{name:"Nevada",rate:0,none:true,fee:350,note:"Commerce tax applies over $4M of revenue.",
    feeNote:"$350 a year for the annual list and state business licence."},
  NH:{name:"New Hampshire",rate:0,none:true,
    note:"No tax on earned income, but business profits tax applies over the filing threshold."},
  NJ:{name:"New Jersey",rate:6.37},
  NM:{name:"New Mexico",rate:4.9,note:"Gross receipts tax applies to services."},
  NY:{name:"New York",rate:6.0,fee:25,note:"New York City adds its own resident income tax on top.",
    feeNote:"An annual LLC filing fee, and at formation a newspaper publication requirement that can run into hundreds."},
  NC:{name:"North Carolina",rate:4.25,flat:true,fee:200,feeNote:"$200 annual report."},
  ND:{name:"North Dakota",rate:2.5},
  OH:{name:"Ohio",rate:3.5,note:"Municipal income tax is separate and near-universal — commonly 2–2.5%."},
  OK:{name:"Oklahoma",rate:4.75},
  OR:{name:"Oregon",rate:8.75,note:"No sales tax, but Portland-metro business taxes are significant."},
  PA:{name:"Pennsylvania",rate:3.07,flat:true,note:"Local earned income tax adds roughly another 1%."},
  RI:{name:"Rhode Island",rate:4.75,fee:400,feeNote:"$400 minimum annual charge."},
  SC:{name:"South Carolina",rate:6.2},
  SD:{name:"South Dakota",rate:0,none:true},
  TN:{name:"Tennessee",rate:0,none:true,
    note:"No income tax on individuals, but a registered entity owes franchise and excise tax on net earnings."},
  TX:{name:"Texas",rate:0,none:true,
    note:"No income tax. Franchise tax applies only above the revenue threshold — most freelancers file a no-tax-due report."},
  UT:{name:"Utah",rate:4.55,flat:true},
  VT:{name:"Vermont",rate:7.6},
  VA:{name:"Virginia",rate:5.75},
  WA:{name:"Washington",rate:0,none:true,
    note:"No income tax, but B&O tax runs on gross receipts — revenue, not profit."},
  WV:{name:"West Virginia",rate:4.82},
  WI:{name:"Wisconsin",rate:5.3},
  WY:{name:"Wyoming",rate:0,none:true}
};

const BIZ_KINDS={
  sole:{label:"Sole proprietor / 1099",se:true,form:"Schedule C",
    note:"Files on Schedule C with your personal return. Profit is self-employment income — income tax plus 15.3% SE tax. Where most freelancers start."},
  llc:{label:"Single-member LLC",se:true,registered:true,form:"Schedule C",
    note:"Liability protection, same tax treatment: Schedule C, profit subject to SE tax, unless you elect S-corp status."},
  partnership:{label:"Partnership / multi-member LLC",se:true,k1:true,registered:true,form:"Form 1065 → K-1",
    note:"Files its own return and issues you a K-1. Your share of the profit is self-employment income."},
  scorp:{label:"S corporation",se:false,salary:true,k1:true,registered:true,form:"Form 1120-S → K-1",
    note:"Pays you a reasonable salary through payroll — that part meets payroll tax — and the rest reaches you as a distribution with no SE tax on it. The saving is real and so is the scrutiny: the salary has to be defensible."},
  ccorp:{label:"C corporation",se:false,entity:true,entityRate:21,registered:true,form:"Form 1120",
    note:"Pays 21% federal tax on its own profit. What it then pays you is a dividend, taxed again. Rarely right for a one-person shop."},
  other:{label:"Other / not sure yet",se:true,form:"Schedule C",
    note:"Treated as a sole proprietorship until you say otherwise — the conservative assumption, since it reserves the most."}};

const ACCT_METHODS={cash:{label:"Cash",note:"Income counts when the money lands, expenses when they leave. Nearly every freelancer uses this."},
  accrual:{label:"Accrual",note:"Income counts when you invoice, expenses when you're billed. Required over $30M of receipts; rare at this size."}};

/* ---------- WHAT A BUSINESS SELLS ----------
   A service business bills time; a product business bills things it had to buy
   or make first. That difference decides what a line on an invoice asks for,
   whether cost of goods sold exists at all, and whether the business is holding
   sales tax that was never its money. */
const BIZ_SELLS={
  service:{label:"Services — time and skill",units:["hour","day","project"],
    note:"Invoice lines are hours, days or a flat project fee. No cost of goods sold, no inventory, and in most states no sales tax on the work itself."},
  product:{label:"Products — physical goods",units:["item"],cogs:true,tax:true,
    note:"What you paid for stock is cost of goods sold, and it comes off revenue before profit. Sales tax you collect was never yours — it is held for the state."},
  both:{label:"Both",units:["hour","day","project","item"],cogs:true,tax:true,
    note:"Time and goods on the same invoice. Cost of goods sold applies to the goods only."}};
const bizSells=b=>BIZ_SELLS[b&&b.sells]||BIZ_SELLS.service;
/* what a line item is measured in */
const ITEM_UNITS={hour:{label:"Hours",one:"hour",rate:"an hour"},
  day:{label:"Days",one:"day",rate:"a day"},
  project:{label:"Flat fee",one:"project",rate:"flat",flat:true},
  item:{label:"Quantity",one:"item",rate:"each",goods:true}};

/* ---------- INVOICE TERMS ----------
   When the money is actually due. Freelancers get paid late; the terms are what
   turn "they haven't paid" into "they are eleven days overdue". */
const PAY_TERMS={
  receipt:{label:"Due on receipt",days:0},
  net7:{label:"Net 7",days:7},
  net14:{label:"Net 14",days:14},
  net15:{label:"Net 15",days:15},
  net30:{label:"Net 30",days:30},
  net45:{label:"Net 45",days:45},
  net60:{label:"Net 60",days:60},
  /* Counted from the day the work happens, not the day you invoiced. Book a
     November gig in August on Net 30 and the balance would fall due in
     September, three months before you have done anything for it. */
  completion:{label:"On completion",fromGig:true,days:0},
  gig7:{label:"7 days after the gig",fromGig:true,days:7},
  gig14:{label:"14 days after the gig",fromGig:true,days:14},
  gig30:{label:"30 days after the gig",fromGig:true,days:30},
  custom:{label:"A date I pick",custom:true}};
/* When a deposit is due. Almost always on booking — that is the point of one. */
const DEPOSIT_DUE={
  booking:{label:"On booking",days:0},
  net7:{label:"Within 7 days",days:7},
  net14:{label:"Within 14 days",days:14},
  custom:{label:"A date I pick",custom:true}};
/* Where an invoice is in its life. `owed` means it is money you are counting on;
   a draft is not, and a written-off one never will be. */
const INV_STATUS={
  draft:{label:"Draft",tag:"neutral",note:"not sent yet — it counts for nothing until it is"},
  sent:{label:"Sent",tag:"neutral",owed:true},
  part:{label:"Part paid",tag:"warn",owed:true},
  paid:{label:"Paid",tag:"ok"},
  overdue:{label:"Overdue",tag:"bad",owed:true},
  void:{label:"Written off",tag:"neutral",note:"work you will not be paid for"}};

const BIZ_COLORS=["#0284c7","#7c5cf0","#0891b2","#ea580c","#059669","#c026d3"];

const TAX_CLASS={
  w2:{label:"W-2 — tax already withheld",note:"Your employer takes it out before you're paid, so nothing extra is reserved."},
  se:{label:"1099 / self-employed",note:"Nothing is withheld. This is the income the reserve is calculated on."},
  exempt:{label:"Not taxable",note:"A roommate's share of rent, a reimbursement, a gift."}
};

/* ============================ GOALS ENGINE ============================
   A goal is a target with a way to read your current position. Most kinds read
   it straight off the rest of the app — a cash goal watches your accounts, a
   payoff goal watches the debt balance — so progress moves on its own and can't
   drift out of step with reality. Only "custom" needs you to log deposits. */
const GOAL_KINDS={
  cash:{label:"Cash savings",short:"Cash",hue:"--c-emerald",
    blurb:"Watches your bank and cash accounts. Leave the accounts blank to track all of them.",dir:"up",auto:true},
  invest:{label:"Investment portfolio",short:"Portfolio",hue:"--c-violet",
    blurb:"Watches what your holdings are worth. Pick specific ones or track the whole portfolio.",dir:"up",auto:true},
  networth:{label:"Net worth",short:"Net worth",hue:"--c-teal",
    blurb:"Everything you own minus everything you owe. The one number that captures all of it.",dir:"up",auto:true},
  debt:{label:"Pay off a debt",short:"Payoff",hue:"--c-amber",
    blurb:"Watches a debt balance falling to zero. Progress counts from what you owed at the start.",dir:"down",auto:true},
  income:{label:"Monthly income",short:"Income",hue:"--c-cyan",
    blurb:"Watches your income streams. Tick passive only to track money that arrives without you working.",dir:"up",auto:true,unit:"/mo"},
  custom:{label:"Save up for something",short:"Custom",hue:"--c-fuchsia",
    blurb:"A gear purchase, a trip, a buffer — you log what you put aside and it tracks the total.",dir:"up",auto:false}
};

/* The things you did not plan for. Kinds exist so a year of them can be read
   back as a pattern rather than a pile — "gear fails about twice a year" is a
   number you can hold a reserve against; "$3,180 of miscellaneous" is not. */
const ONEOFF_KINDS={
  medical:{label:"Health & medical",short:"Medical",hue:"--c-rose",
    blurb:"Exams, glasses, dental, prescriptions, a trip to urgent care."},
  repair:{label:"Repair or breakdown",short:"Repair",hue:"--c-amber",
    blurb:"The car, the boiler, the laptop — something broke and had to be fixed."},
  gear:{label:"Gear replacement",short:"Gear",hue:"--c-violet",
    blurb:"A body, a lens, a drive that died mid-job. Work kit that failed rather than kit you chose to buy."},
  home:{label:"Home & moving",short:"Home",hue:"--c-teal",
    blurb:"A deposit, a move, a repair the landlord would not cover."},
  travel:{label:"Family & travel",short:"Family",hue:"--c-cyan",
    blurb:"A funeral, a flight home, an emergency someone else was having."},
  admin:{label:"Legal & admin",short:"Admin",hue:"--c-slate",
    blurb:"Fines, filings, licences, a lawyer's hour."},
  pet:{label:"Pet",short:"Pet",hue:"--c-lime",blurb:"The vet, mostly."},
  other:{label:"Something else",short:"One-off",hue:"--c-fuchsia",
    blurb:"A one-off that does not fit the rest."}
};

const ICONS={
 dash:'<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
 accounts:'<rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M2 10.5h20M6 15h4"/>',
 income:'<path d="M12 20V4M5 11l7-7 7 7"/>',
 expenses:'<path d="M12 4v16M19 13l-7 7-7-7"/>',
 budget:'<circle cx="12" cy="12" r="9"/><path d="M12 12V3.5M12 12l6.5 5.5"/>',
 goals:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
 credit:'<path d="M3 17l5.5-6 4 4L21 6"/><path d="M15 6h6v6"/>',
 invest:'<rect x="3" y="12" width="4.5" height="9" rx="1.2"/><rect x="9.75" y="7" width="4.5" height="14" rx="1.2"/><rect x="16.5" y="3" width="4.5" height="18" rx="1.2"/>',
 data:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 tax:'<path d="M9 3h6l1 4H8l1-4z"/><path d="M6 7h12l1.2 12.2A2 2 0 0 1 17.2 21H6.8a2 2 0 0 1-2-1.8L6 7z"/><path d="M12 11v6M9.5 12.5h5M9.5 15.5h5"/>',
 retire:'<path d="M12 21s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.7 12 21 12 21z"/><path d="M12 8V3"/>',
 business:'<path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>'
};

const VIEWS=[
 {id:"dash",label:"Home"},{id:"accounts",label:"Accounts"},{id:"income",label:"Income"},
 {id:"expenses",label:"Spending"},{id:"budget",label:"Budget"},{id:"goals",label:"Goals"},
 {id:"credit",label:"Debt"},{id:"invest",label:"Invest"},{id:"retire",label:"Retirement"},{id:"tax",label:"Tax"},
 {id:"business",label:"Business"},{id:"data",label:"Settings"}
];

/* Four shortcuts was never enough for eleven screens, and the rest lived behind
   the menu. The bar carries two pages now and swipes between them — the Home
   button does not travel, because it is the one thing that must always be in
   the same place under your thumb. */
const NAV_DEFAULTS=[["accounts","expenses","budget","invest"],
                    ["income","credit","goals","business"]];
