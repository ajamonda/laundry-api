import {
  CatalogInputType,
  CatalogPriceType,
  CatalogSelectionType,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

type PriceSeed =
  | { priceType: 'FIXED' | 'MATRIX'; amount: number }
  | { priceType: 'RANGE'; minAmount: number; maxAmount: number }
  | {
      priceType: 'UNIT';
      baseAmount: number;
      baseQuantity: string;
      baseUnit: string;
      extraUnitQuantity: string;
      extraUnitAmount: number;
    };

type OptionSeed = {
  code: string;
  displayName: string;
  price?: PriceSeed;
  requiresInput?: boolean;
  inputType?: 'TEXT' | 'NUMBER';
  inputUnit?: string;
  children?: OptionSeed[];
};

type OptionGroupSeed = {
  code: string;
  displayName: string;
  selectionType: 'SINGLE' | 'MULTI';
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: OptionSeed[];
};

type ItemSeed = {
  code: string;
  displayName: string;
  photoRequired?: boolean;
  processingRouteCode?: string;
  optionGroups: OptionGroupSeed[];
  inputs?: Array<{
    code: string;
    displayName: string;
    inputType: 'TEXT' | 'NUMBER';
    required?: boolean;
  }>;
};

const shirtOptionGroups: OptionGroupSeed[] = [
  {
    code: 'cleaning_method',
    displayName: '세탁 방법',
    selectionType: 'SINGLE',
    required: true,
    options: [
      fixed('regular_wash', '일반 세탁', 2400),
      fixed('premium_wash', '프리미엄 세탁', 25000),
      fixed('deodorize_wrinkle_care', '탈취구김 케어', 1765),
    ],
  },
  {
    code: 'additional_care',
    displayName: '추가 케어',
    selectionType: 'MULTI',
    options: [
      range('stain_care', '얼룩 케어', 2900, 4900),
      range('lint_care', '보풀 케어', 0, 3000),
      fixed('hand_ironing', '손다림질', 1800),
    ],
  },
  {
    code: 'repair',
    displayName: '수선',
    selectionType: 'MULTI',
    options: [
      {
        code: 'sleeve_arm_repair',
        displayName: '소매, 팔 수선',
        children: [
          fixed('sleeve_length_shortening', '소매기장 줄임', 15000),
          fixed('sleeve_width_narrowing', '소매통 줄임', 13000),
        ],
      },
      {
        code: 'pulled_thread_repair',
        displayName: '올뜯김 수선',
        children: [
          fixed('pulled_thread_under_1cm', '올뜯김 수선 1cm 이하', 25000),
          unit(
            'pulled_thread_extra_per_0_5cm',
            '올뜯김 수선 추가 초과 0.5cm 당',
            {
              baseAmount: 0,
              baseQuantity: '0',
              baseUnit: 'cm',
              extraUnitQuantity: '0.5',
              extraUnitAmount: 10000,
            },
          ),
        ],
      },
    ],
  },
];

const washingNoticeGroup: OptionGroupSeed = {
  code: 'washing_notice',
  displayName: '세탁시 유의사항',
  selectionType: 'MULTI',
  options: [
    {
      code: 'fragile_material',
      displayName: '쉽게 손상되는 소재예요',
    },
    {
      code: 'accessory_detachment',
      displayName: '부속품이 떨어질 수 있어요',
    },
  ],
};

const shoeRepairOptions: OptionSeed[] = [
  {
    code: 'sole_repair',
    displayName: '밑창 수선',
    children: [
      fixed('partial_sole_bonding', '부분 밑창 접착', 25000),
      fixed('full_sole_bonding', '전체 밑창 접착', 29000),
    ],
  },
  {
    code: 'heel_outsole_repair',
    displayName: '뒤꿈치, 아웃솔 수선',
    children: [
      fixed('heel_fabric_replacement', '뒤꿈치 원단 교체', 39000),
      fixed('outsole_discoloration_restore', '아웃솔 변색 복원', 19000),
    ],
  },
];

const items: ItemSeed[] = [
  {
    code: 'shirt',
    displayName: '셔츠',
    photoRequired: false,
    processingRouteCode: 'GENERAL_CLOTHES_CLEANING',
    optionGroups: shirtOptionGroups,
  },
  {
    code: 'pants',
    displayName: '바지',
    photoRequired: false,
    processingRouteCode: 'GENERAL_CLOTHES_CLEANING',
    optionGroups: [
      {
        code: 'cleaning_method',
        displayName: '세탁 방법',
        selectionType: 'SINGLE',
        required: true,
        options: [
          fixed('regular_wash', '일반 세탁', 5500),
          fixed('premium_wash', '프리미엄 세탁', 30000),
          fixed('deodorize_wrinkle_care', '탈취구김 케어', 1765),
        ],
      },
      {
        code: 'additional_care',
        displayName: '추가 케어',
        selectionType: 'MULTI',
        options: [
          range('stain_care', '얼룩 케어', 2900, 4900),
          range('lint_care', '보풀 케어', 0, 3000),
        ],
      },
      {
        code: 'repair',
        displayName: '수선',
        selectionType: 'MULTI',
        options: [
          {
            code: 'length_repair',
            displayName: '기장 수선',
            children: [
              fixed('length_shortening', '기장 줄임', 6000),
              fixed('length_extension', '기장 늘림', 7000),
            ],
          },
          {
            code: 'pulled_thread_repair',
            displayName: '올뜯김 수선',
            children: [
              fixed('pulled_thread_under_1cm', '올뜯김 수선 1cm 이하', 25000),
              unit(
                'pulled_thread_extra_per_0_5cm',
                '올뜯김 수선 추가 초과 0.5cm 당',
                {
                  baseAmount: 0,
                  baseQuantity: '0',
                  baseUnit: 'cm',
                  extraUnitQuantity: '0.5',
                  extraUnitAmount: 10000,
                },
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'sneakers',
    displayName: '운동화',
    photoRequired: false,
    processingRouteCode: 'STANDARD_SHOES_CLEANING',
    optionGroups: [
      {
        code: 'cleaning_method',
        displayName: '세탁 방법',
        selectionType: 'SINGLE',
        required: true,
        options: [
          fixed('regular_wash', '일반 세탁', 6900),
          fixed('premium_wash', '프리미엄 세탁', 35000),
        ],
      },
      {
        code: 'additional_care',
        displayName: '추가 케어',
        selectionType: 'MULTI',
        options: [
          range('stain_care', '얼룩 케어', 2900, 4900),
          range('lint_care', '보풀 케어', 0, 3000),
        ],
      },
      {
        code: 'repair',
        displayName: '수선',
        selectionType: 'MULTI',
        options: shoeRepairOptions,
      },
      washingNoticeGroup,
    ],
  },
  {
    code: 'ugg_boots',
    displayName: '어그부츠',
    photoRequired: false,
    processingRouteCode: 'STANDARD_SHOES_CLEANING',
    inputs: [
      {
        code: 'characteristics_text',
        displayName: '세탁물 특징',
        inputType: 'TEXT',
      },
    ],
    optionGroups: [
      {
        code: 'cleaning_method',
        displayName: '세탁 방법',
        selectionType: 'SINGLE',
        required: true,
        options: [
          fixed('regular_wash', '일반 세탁', 20000),
          fixed('premium_wash', '프리미엄 세탁', 50000),
        ],
      },
      {
        code: 'additional_care',
        displayName: '추가 케어',
        selectionType: 'MULTI',
        options: [
          range('stain_care', '얼룩 케어', 2900, 4900),
          range('lint_care', '보풀 케어', 0, 3000),
          fixed('water_repellent_coating', '발수코팅', 5000),
        ],
      },
      {
        code: 'repair',
        displayName: '수선',
        selectionType: 'MULTI',
        options: shoeRepairOptions,
      },
      washingNoticeGroup,
    ],
  },
  {
    code: 'accessory_shirt',
    displayName: '악세사리가 달린 셔츠',
    photoRequired: false,
    processingRouteCode: 'GENERAL_CLOTHES_CLEANING',
    optionGroups: shirtOptionGroups,
  },
  {
    code: 'tent',
    displayName: '텐트',
    processingRouteCode: 'OUTSOURCED_ONLY_CLEANING',
    optionGroups: [
      {
        code: 'material',
        displayName: '재질',
        selectionType: 'SINGLE',
        required: true,
        options: [
          {
            code: 'polyester',
            displayName: '폴리',
            children: [
              matrix('polyester_under_5m', '5m 미만', 65000),
              matrix('polyester_from_5m_to_under_6m', '5m 이상 6m 미만', 80000),
            ],
          },
          {
            code: 'cotton',
            displayName: '면',
            children: [
              matrix('cotton_under_5m', '5m 미만', 125000),
              matrix('cotton_from_5m_to_under_6m', '5m 이상 6m 미만', 135000),
            ],
          },
        ],
      },
      {
        code: 'additional_care',
        displayName: '추가 케어',
        selectionType: 'MULTI',
        options: [
          fixed('water_repellent_coating', '발수코팅', 30000),
          fixed('mold_removal', '곰팡이 제거', 20000),
        ],
      },
    ],
  },
  {
    code: 'quick_laundry',
    displayName: '생활 빨래',
    processingRouteCode: 'QUICK_LAUNDRY',
    inputs: [
      {
        code: 'bag_characteristics_text',
        displayName: '가방 특징',
        inputType: 'TEXT',
      },
    ],
    optionGroups: [
      {
        code: 'cleaning_method',
        displayName: '세탁 방법',
        selectionType: 'SINGLE',
        required: true,
        options: [
          unit('water_wash_high_temperature_dry', '물세탁 후 고온건조', {
            baseAmount: 9600,
            baseQuantity: '3',
            baseUnit: 'kg',
            extraUnitQuantity: '0.5',
            extraUnitAmount: 800,
          }),
        ],
      },
      {
        code: 'additional_care',
        displayName: '추가 케어',
        selectionType: 'MULTI',
        options: [
          fixed('underwear_separate_wash', '속옷 분리 세탁', 1000),
          unit('natural_detergent', '천연 세제', {
            baseAmount: 3600,
            baseQuantity: '3',
            baseUnit: 'kg',
            extraUnitQuantity: '0.5',
            extraUnitAmount: 600,
          }),
        ],
      },
    ],
  },
];

async function main() {
  for (const [index, item] of items.entries()) {
    await seedItem(item, index + 1);
  }

  await seedOrderRequestOptions();
  await seedPickupVehicles();
  await seedPickupBags();
  await seedProcessingRoutes();
  await seedRouteResolutionRules();
  await seedExceptionFlowTemplates();
  await seedDeliveryVehicles();
}

async function seedRouteResolutionRules() {
  // (itemCode, isPremium, hasRepair) → routeCode
  // Specific rules carry priority 10; per-item fallbacks (options don't
  // affect route) use priority 0 with null wildcards.
  type Rule = { itemCode: string; isPremium: boolean | null; hasRepair: boolean | null; routeCode: string; priority: number };

  const garmentItems = ['shirt', 'pants', 'accessory_shirt'];
  const rules: Rule[] = [];

  for (const itemCode of garmentItems) {
    rules.push(
      { itemCode, isPremium: false, hasRepair: false, routeCode: 'GENERAL_CLOTHES_CLEANING', priority: 10 },
      { itemCode, isPremium: false, hasRepair: true,  routeCode: 'REPAIR_AND_CLEANING',       priority: 10 },
      { itemCode, isPremium: true,  hasRepair: false, routeCode: 'PREMIUM_CLEANING',          priority: 10 },
      { itemCode, isPremium: true,  hasRepair: true,  routeCode: 'REPAIR_AND_PREMIUM_CLEANING', priority: 10 },
    );
  }

  rules.push(
    { itemCode: 'sneakers', isPremium: false, hasRepair: false, routeCode: 'STANDARD_SHOES_CLEANING',           priority: 10 },
    { itemCode: 'sneakers', isPremium: false, hasRepair: true,  routeCode: 'REPAIR_AND_SHOES_CLEANING',         priority: 10 },
    { itemCode: 'sneakers', isPremium: true,  hasRepair: false, routeCode: 'PREMIUM_SHOES_CLEANING',            priority: 10 },
    { itemCode: 'sneakers', isPremium: true,  hasRepair: true,  routeCode: 'REPAIR_AND_PREMIUM_SHOES_CLEANING', priority: 10 },
  );

  rules.push(
    { itemCode: 'ugg_boots', isPremium: false, hasRepair: false, routeCode: 'STANDARD_SHOES_CLEANING',            priority: 10 },
    { itemCode: 'ugg_boots', isPremium: false, hasRepair: true,  routeCode: 'OUTSOURCED_CLEANING',                priority: 10 },
    { itemCode: 'ugg_boots', isPremium: true,  hasRepair: false, routeCode: 'PREMIUM_SHOES_CLEANING',             priority: 10 },
    { itemCode: 'ugg_boots', isPremium: true,  hasRepair: true,  routeCode: 'OUTSOURCED_PREMIUM_SHOES_CLEANING',  priority: 10 },
  );

  // Wildcard rules — options don't affect route choice.
  rules.push(
    { itemCode: 'tent',          isPremium: null, hasRepair: null, routeCode: 'OUTSOURCED_ONLY_CLEANING', priority: 0 },
    { itemCode: 'quick_laundry', isPremium: null, hasRepair: null, routeCode: 'QUICK_LAUNDRY',            priority: 0 },
  );

  // Idempotent: clear + insert. Volume is tiny.
  await prisma.routeResolutionRule.deleteMany();
  await prisma.routeResolutionRule.createMany({ data: rules });

  console.log(`Seeded ${rules.length} route resolution rules`);
}

async function seedPickupVehicles() {
  const vehicles = [
    { code: 'PICKUP-VAN-01', displayName: 'Pickup Van 01' },
    { code: 'PICKUP-VAN-02', displayName: 'Pickup Van 02' },
    { code: 'PICKUP-VAN-03', displayName: 'Pickup Van 03' },
  ];

  for (const vehicle of vehicles) {
    await prisma.pickupVehicle.upsert({
      where: { code: vehicle.code },
      update: {
        displayName: vehicle.displayName,
        active: true,
      },
      create: {
        code: vehicle.code,
        displayName: vehicle.displayName,
        active: true,
      },
    });
  }
}

async function seedPickupBags() {
  for (let index = 1; index <= 10; index += 1) {
    const barcode = `PICKUP-BAG-${String(index).padStart(3, '0')}`;
    await prisma.pickupBag.upsert({
      where: { barcode },
      update: {
        active: true,
      },
      create: {
        barcode,
        active: true,
      },
    });
  }
}

type ProcessingRouteStepSeed = {
  sortOrder: number;
  stepType: string;
  displayName: string;
};

type ProcessingRouteSeed = {
  code: string;
  displayName: string;
  steps: ProcessingRouteStepSeed[];
};

const PROCESSING_ROUTE_SEEDS: ProcessingRouteSeed[] = [
  {
    code: 'GENERAL_CLOTHES_CLEANING',
    displayName: '일반 의류 세탁',
    steps: [
      { sortOrder: 100, stepType: 'WASHING', displayName: '세탁' },
      { sortOrder: 200, stepType: 'AIR_DRYING', displayName: '건조' },
      { sortOrder: 300, stepType: 'PRESSING', displayName: '다림질' },
      { sortOrder: 400, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 500, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'REPAIR_AND_CLEANING',
    displayName: '수선 + 일반 세탁',
    steps: [
      { sortOrder: 100, stepType: 'REPAIRING', displayName: '수선' },
      { sortOrder: 150, stepType: 'REPAIR_INSPECTING', displayName: '수선 검수' },
      { sortOrder: 200, stepType: 'WASHING', displayName: '세탁' },
      { sortOrder: 300, stepType: 'AIR_DRYING', displayName: '건조' },
      { sortOrder: 400, stepType: 'PRESSING', displayName: '다림질' },
      { sortOrder: 500, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 600, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'PREMIUM_CLEANING',
    displayName: '프리미엄 세탁',
    steps: [
      {
        sortOrder: 100,
        stepType: 'PREMIUM_WASHING',
        displayName: '프리미엄 세탁',
      },
      {
        sortOrder: 200,
        stepType: 'PREMIUM_DRYING',
        displayName: '프리미엄 건조',
      },
      {
        sortOrder: 300,
        stepType: 'PREMIUM_PRESSING',
        displayName: '프리미엄 다림질',
      },
      {
        sortOrder: 400,
        stepType: 'PREMIUM_INSPECTING',
        displayName: '프리미엄 검수',
      },
      { sortOrder: 500, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'OUTSOURCED_CLEANING',
    displayName: '외주 수선 + 신발 세탁',
    steps: [
      { sortOrder: 100, stepType: 'WAITING_FOR_VENDOR', displayName: '외주 출고 대기' },
      { sortOrder: 200, stepType: 'HAND_OVER_TO_VENDOR', displayName: '외주 출고' },
      { sortOrder: 300, stepType: 'TAKE_OVER_FROM_VENDOR', displayName: '외주 입고' },
      { sortOrder: 400, stepType: 'WASHING', displayName: '세탁' },
      { sortOrder: 500, stepType: 'AIR_DRYING', displayName: '건조' },
      { sortOrder: 600, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 700, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'STANDARD_SHOES_CLEANING',
    displayName: '신발 세탁',
    steps: [
      { sortOrder: 100, stepType: 'WASHING', displayName: '세탁' },
      { sortOrder: 200, stepType: 'AIR_DRYING', displayName: '건조' },
      { sortOrder: 300, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 400, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'OUTSOURCED_ONLY_CLEANING',
    displayName: '외주 세탁',
    steps: [
      { sortOrder: 100, stepType: 'WAITING_FOR_VENDOR', displayName: '외주 출고 대기' },
      { sortOrder: 200, stepType: 'HAND_OVER_TO_VENDOR', displayName: '외주 출고' },
      { sortOrder: 300, stepType: 'TAKE_OVER_FROM_VENDOR', displayName: '외주 입고' },
      { sortOrder: 400, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 500, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'QUICK_LAUNDRY',
    displayName: '생활 빨래',
    steps: [
      { sortOrder: 100, stepType: 'WASHING', displayName: '세탁' },
      { sortOrder: 200, stepType: 'MACHINE_DRYING', displayName: '기계 건조' },
      { sortOrder: 300, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 400, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'PREMIUM_SHOES_CLEANING',
    displayName: '프리미엄 신발 세탁',
    steps: [
      { sortOrder: 100, stepType: 'PREMIUM_WASHING', displayName: '프리미엄 세탁' },
      { sortOrder: 200, stepType: 'PREMIUM_DRYING', displayName: '프리미엄 건조' },
      { sortOrder: 300, stepType: 'PREMIUM_INSPECTING', displayName: '프리미엄 검수' },
      { sortOrder: 400, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'REPAIR_AND_SHOES_CLEANING',
    displayName: '수선 + 신발 세탁',
    steps: [
      { sortOrder: 100, stepType: 'REPAIRING', displayName: '수선' },
      { sortOrder: 150, stepType: 'REPAIR_INSPECTING', displayName: '수선 검수' },
      { sortOrder: 200, stepType: 'WASHING', displayName: '세탁' },
      { sortOrder: 300, stepType: 'AIR_DRYING', displayName: '건조' },
      { sortOrder: 400, stepType: 'INSPECTING', displayName: '검수' },
      { sortOrder: 500, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'OUTSOURCED_PREMIUM_SHOES_CLEANING',
    displayName: '외주 수선 + 프리미엄 신발 세탁',
    steps: [
      { sortOrder: 100, stepType: 'WAITING_FOR_VENDOR', displayName: '외주 출고 대기' },
      { sortOrder: 200, stepType: 'HAND_OVER_TO_VENDOR', displayName: '외주 출고' },
      { sortOrder: 300, stepType: 'TAKE_OVER_FROM_VENDOR', displayName: '외주 입고' },
      { sortOrder: 400, stepType: 'PREMIUM_WASHING', displayName: '프리미엄 세탁' },
      { sortOrder: 500, stepType: 'PREMIUM_DRYING', displayName: '프리미엄 건조' },
      { sortOrder: 600, stepType: 'PREMIUM_INSPECTING', displayName: '프리미엄 검수' },
      { sortOrder: 700, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'REPAIR_AND_PREMIUM_SHOES_CLEANING',
    displayName: '수선 + 프리미엄 신발 세탁',
    steps: [
      { sortOrder: 100, stepType: 'REPAIRING', displayName: '수선' },
      { sortOrder: 150, stepType: 'PREMIUM_REPAIR_INSPECTING', displayName: '프리미엄 수선 검수' },
      { sortOrder: 200, stepType: 'PREMIUM_WASHING', displayName: '프리미엄 세탁' },
      { sortOrder: 300, stepType: 'PREMIUM_DRYING', displayName: '프리미엄 건조' },
      { sortOrder: 400, stepType: 'PREMIUM_INSPECTING', displayName: '프리미엄 검수' },
      { sortOrder: 500, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'REPAIR_AND_PREMIUM_CLEANING',
    displayName: '수선 + 프리미엄 세탁',
    steps: [
      { sortOrder: 100, stepType: 'REPAIRING', displayName: '수선' },
      { sortOrder: 150, stepType: 'PREMIUM_REPAIR_INSPECTING', displayName: '프리미엄 수선 검수' },
      { sortOrder: 200, stepType: 'PREMIUM_WASHING', displayName: '프리미엄 세탁' },
      { sortOrder: 300, stepType: 'PREMIUM_DRYING', displayName: '프리미엄 건조' },
      { sortOrder: 400, stepType: 'PREMIUM_PRESSING', displayName: '프리미엄 다림질' },
      { sortOrder: 500, stepType: 'PREMIUM_INSPECTING', displayName: '프리미엄 검수' },
      { sortOrder: 600, stepType: 'READY_TO_PACKAGE', displayName: '포장 준비' },
    ],
  },
  {
    code: 'SECOND_HAND_PROCESSING',
    displayName: '헌옷 처리',
    steps: [{ sortOrder: 100, stepType: 'FINISHED', displayName: '처리 완료' }],
  },
];

async function seedProcessingRoutes() {
  for (const route of PROCESSING_ROUTE_SEEDS) {
    const upserted = await prisma.processingRoute.upsert({
      where: { code: route.code },
      update: {
        displayName: route.displayName,
        active: true,
      },
      create: {
        code: route.code,
        displayName: route.displayName,
        active: true,
      },
    });

    await prisma.processingRouteStep.deleteMany({
      where: { routeId: upserted.id },
    });

    for (const step of route.steps) {
      await prisma.processingRouteStep.create({
        data: {
          routeId: upserted.id,
          sortOrder: step.sortOrder,
          stepType: step.stepType,
          displayName: step.displayName,
        },
      });
    }
  }
}

async function seedItem(item: ItemSeed, sortOrder: number) {
  const catalogItem = await prisma.catalogItem.upsert({
    where: { code: item.code },
    update: {
      displayName: item.displayName,
      photoRequired: item.photoRequired ?? false,
      processingRouteCode: item.processingRouteCode ?? null,
      sortOrder,
      active: true,
    },
    create: {
      code: item.code,
      displayName: item.displayName,
      photoRequired: item.photoRequired ?? false,
      processingRouteCode: item.processingRouteCode ?? null,
      sortOrder,
      active: true,
    },
  });

  await prisma.catalogItemInput.deleteMany({
    where: { catalogItemId: catalogItem.id },
  });
  for (const [index, input] of (item.inputs ?? []).entries()) {
    await prisma.catalogItemInput.create({
      data: {
        catalogItemId: catalogItem.id,
        code: input.code,
        displayName: input.displayName,
        inputType: toInputType(input.inputType),
        required: input.required ?? false,
        sortOrder: index + 1,
        active: true,
      },
    });
  }

  const existingGroups = await prisma.catalogOptionGroup.findMany({
    where: { catalogItemId: catalogItem.id },
  });
  for (const group of existingGroups) {
    if (!item.optionGroups.some((seedGroup) => seedGroup.code === group.code)) {
      await prisma.catalogOptionGroup.update({
        where: { id: group.id },
        data: { active: false },
      });
    }
  }

  for (const [index, group] of item.optionGroups.entries()) {
    await seedOptionGroup(catalogItem.id, group, index + 1);
  }
}

async function seedOptionGroup(
  catalogItemId: string,
  group: OptionGroupSeed,
  sortOrder: number,
) {
  const existing = await prisma.catalogOptionGroup.findFirst({
    where: { catalogItemId, code: group.code },
  });
  const optionGroup = existing
    ? await prisma.catalogOptionGroup.update({
        where: { id: existing.id },
        data: {
          displayName: group.displayName,
          selectionType: toSelectionType(group.selectionType),
          required: group.required ?? false,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          sortOrder,
          active: true,
        },
      })
    : await prisma.catalogOptionGroup.create({
        data: {
          catalogItemId,
          code: group.code,
          displayName: group.displayName,
          selectionType: toSelectionType(group.selectionType),
          required: group.required ?? false,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          sortOrder,
          active: true,
        },
      });

  const existingOptions = await prisma.catalogOption.findMany({
    where: { catalogOptionGroupId: optionGroup.id },
  });
  for (const option of existingOptions) {
    await prisma.catalogOption.update({
      where: { id: option.id },
      data: { active: false },
    });
  }

  for (const [index, option] of group.options.entries()) {
    await seedOption(optionGroup.id, null, option, index + 1);
  }
}

async function seedOption(
  catalogOptionGroupId: string,
  parentOptionId: string | null,
  option: OptionSeed,
  sortOrder: number,
) {
  const existing = await prisma.catalogOption.findFirst({
    where: {
      catalogOptionGroupId,
      parentOptionId,
      code: option.code,
    },
  });
  const catalogOption = existing
    ? await prisma.catalogOption.update({
        where: { id: existing.id },
        data: {
          displayName: option.displayName,
          requiresInput: option.requiresInput ?? false,
          inputType: option.inputType ? toInputType(option.inputType) : null,
          inputUnit: option.inputUnit,
          sortOrder,
          active: true,
        },
      })
    : await prisma.catalogOption.create({
        data: {
          catalogOptionGroupId,
          parentOptionId,
          code: option.code,
          displayName: option.displayName,
          requiresInput: option.requiresInput ?? false,
          inputType: option.inputType ? toInputType(option.inputType) : null,
          inputUnit: option.inputUnit,
          sortOrder,
          active: true,
        },
      });

  await prisma.catalogOptionPrice.deleteMany({
    where: { catalogOptionId: catalogOption.id },
  });
  if (option.price) {
    await prisma.catalogOptionPrice.create({
      data: {
        catalogOptionId: catalogOption.id,
        priceType: toPriceType(option.price.priceType),
        currency: 'KRW',
        amount: 'amount' in option.price ? option.price.amount : undefined,
        minAmount:
          option.price.priceType === 'RANGE'
            ? option.price.minAmount
            : undefined,
        maxAmount:
          option.price.priceType === 'RANGE'
            ? option.price.maxAmount
            : undefined,
        baseAmount:
          option.price.priceType === 'UNIT'
            ? option.price.baseAmount
            : undefined,
        baseQuantity:
          option.price.priceType === 'UNIT'
            ? option.price.baseQuantity
            : undefined,
        baseUnit:
          option.price.priceType === 'UNIT' ? option.price.baseUnit : undefined,
        extraUnitQuantity:
          option.price.priceType === 'UNIT'
            ? option.price.extraUnitQuantity
            : undefined,
        extraUnitAmount:
          option.price.priceType === 'UNIT'
            ? option.price.extraUnitAmount
            : undefined,
      },
    });
  }

  for (const [index, child] of (option.children ?? []).entries()) {
    await seedOption(catalogOptionGroupId, catalogOption.id, child, index + 1);
  }
}

async function seedOrderRequestOptions() {
  await seedOrderRequestOption({
    groupCode: 'fulfillment',
    code: 'delivery',
    displayName: '배송',
    children: [
      { code: 'economy_delivery', displayName: '알뜰배송' },
      { code: 'fast_delivery', displayName: '빠른배송' },
      { code: 'regular_delivery', displayName: '일반배송' },
    ],
  });
  await seedOrderRequestOption({
    groupCode: 'fulfillment',
    code: 'storage',
    displayName: '보관',
    children: [
      { code: 'storage_3_months', displayName: '3개월 보관' },
      { code: 'storage_6_months', displayName: '6개월 보관' },
    ],
  });
  await seedOrderRequestOption({
    groupCode: 'pickup_delivery_place',
    code: 'front_door',
    displayName: '문 앞',
  });
  await seedOrderRequestOption({
    groupCode: 'pickup_delivery_place',
    code: 'security_office',
    displayName: '경비실 보관',
  });
  await seedOrderRequestOption({
    groupCode: 'pickup_delivery_place',
    code: 'custom_place_text',
    displayName: '직접 입력하기',
    requiresInput: true,
    inputType: 'TEXT',
  });
  await seedOrderRequestOption({
    groupCode: 'second_hand_pickup',
    code: 'second_hand_pickup_requested',
    displayName: '헌옷 수거 여부',
  });
}

async function seedOrderRequestOption(input: {
  groupCode: string;
  code: string;
  displayName: string;
  parentOptionId?: string | null;
  requiresInput?: boolean;
  inputType?: 'TEXT' | 'NUMBER';
  children?: Array<{ code: string; displayName: string }>;
}) {
  const existing = await prisma.orderRequestOption.findFirst({
    where: {
      groupCode: input.groupCode,
      code: input.code,
      parentOptionId: input.parentOptionId ?? null,
    },
  });
  const option = existing
    ? await prisma.orderRequestOption.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName,
          requiresInput: input.requiresInput ?? false,
          inputType: input.inputType ? toInputType(input.inputType) : null,
          active: true,
        },
      })
    : await prisma.orderRequestOption.create({
        data: {
          groupCode: input.groupCode,
          code: input.code,
          displayName: input.displayName,
          parentOptionId: input.parentOptionId ?? null,
          requiresInput: input.requiresInput ?? false,
          inputType: input.inputType ? toInputType(input.inputType) : null,
          active: true,
        },
      });

  for (const child of input.children ?? []) {
    await seedOrderRequestOption({
      groupCode: input.groupCode,
      parentOptionId: option.id,
      code: child.code,
      displayName: child.displayName,
    });
  }
}

function fixed(code: string, displayName: string, amount: number): OptionSeed {
  return {
    code,
    displayName,
    price: { priceType: 'FIXED', amount },
  };
}

function matrix(code: string, displayName: string, amount: number): OptionSeed {
  return {
    code,
    displayName,
    price: { priceType: 'MATRIX', amount },
  };
}

function range(
  code: string,
  displayName: string,
  minAmount: number,
  maxAmount: number,
): OptionSeed {
  return {
    code,
    displayName,
    price: { priceType: 'RANGE', minAmount, maxAmount },
  };
}

function unit(
  code: string,
  displayName: string,
  price: Omit<Extract<PriceSeed, { priceType: 'UNIT' }>, 'priceType'>,
): OptionSeed {
  return {
    code,
    displayName,
    requiresInput: true,
    inputType: 'NUMBER',
    price: { priceType: 'UNIT', ...price },
  };
}

function toSelectionType(value: 'SINGLE' | 'MULTI'): CatalogSelectionType {
  return value === 'SINGLE'
    ? CatalogSelectionType.SINGLE
    : CatalogSelectionType.MULTI;
}

function toInputType(value: 'TEXT' | 'NUMBER'): CatalogInputType {
  return value === 'TEXT' ? CatalogInputType.TEXT : CatalogInputType.NUMBER;
}

function toPriceType(value: PriceSeed['priceType']): CatalogPriceType {
  if (value === 'FIXED') return CatalogPriceType.FIXED;
  if (value === 'RANGE') return CatalogPriceType.RANGE;
  if (value === 'UNIT') return CatalogPriceType.UNIT;
  return CatalogPriceType.MATRIX;
}

type ExceptionFlowStepSeed = {
  offset: number;
  stepType: string;
  displayName: string;
};
type ExceptionFlowSeed = {
  code: string;
  displayName: string;
  steps: ExceptionFlowStepSeed[];
};

const EXCEPTION_FLOW_SEEDS: ExceptionFlowSeed[] = [
  {
    code: 'REPAIR_APPROVAL_FLOW',
    displayName: '수선 승인 플로우',
    steps: [
      { offset: 10, stepType: 'REPAIR_ESTIMATE', displayName: '수선 견적' },
      {
        offset: 20,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 수선 승인 요청',
      },
      {
        offset: 30,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 응답 대기',
      },
      {
        offset: 40,
        stepType: 'APPLY_CUSTOMER_DECISION',
        displayName: '고객 결정 반영',
      },
    ],
  },
  {
    code: 'VENDOR_APPROVAL_FLOW',
    displayName: '외주 승인 플로우',
    steps: [
      { offset: 10, stepType: 'VENDOR_ESTIMATE', displayName: '외주 견적' },
      {
        offset: 20,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 외주 승인 요청',
      },
      {
        offset: 30,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 응답 대기',
      },
      {
        offset: 40,
        stepType: 'APPLY_CUSTOMER_DECISION',
        displayName: '고객 결정 반영',
      },
    ],
  },
  {
    code: 'PREMIUM_APPROVAL_FLOW',
    displayName: '프리미엄 승인 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'PREMIUM_NOTICE',
        displayName: '프리미엄 처리 안내',
      },
      {
        offset: 20,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 프리미엄 승인 요청',
      },
      {
        offset: 30,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 응답 대기',
      },
      {
        offset: 40,
        stepType: 'APPLY_CUSTOMER_DECISION',
        displayName: '고객 결정 반영',
      },
    ],
  },
  {
    code: 'REWASH_FLOW',
    displayName: '재세탁 플로우',
    steps: [
      { offset: 10, stepType: 'REWASHING', displayName: '재세탁' },
      { offset: 20, stepType: 'RE_AIR_DRYING', displayName: '재건조' },
      { offset: 30, stepType: 'RE_PRESSING', displayName: '재다림질' },
      { offset: 40, stepType: 'RE_INSPECTION', displayName: '재검수' },
    ],
  },
  {
    code: 'ADDITIONAL_REPAIR_FLOW',
    displayName: '추가 수선 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 승인 요청',
      },
      {
        offset: 20,
        stepType: 'ADDITIONAL_REPAIR_ESTIMATE',
        displayName: '추가 수선 견적',
      },
      {
        offset: 30,
        stepType: 'ADDITIONAL_REPAIRING',
        displayName: '추가 수선',
      },
      {
        offset: 40,
        stepType: 'ADDITIONAL_REPAIR_CHECK',
        displayName: '추가 수선 검수',
      },
    ],
  },
  {
    code: 'ADDITIONAL_VENDOR_FLOW',
    displayName: '추가 외주 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 승인 요청',
      },
      {
        offset: 20,
        stepType: 'ADDITIONAL_VENDOR_ESTIMATE',
        displayName: '추가 외주 견적',
      },
      { offset: 30, stepType: 'HAND_OVER_TO_VENDOR', displayName: '외주 출고' },
      {
        offset: 40,
        stepType: 'TAKE_OVER_FROM_VENDOR',
        displayName: '외주 입고',
      },
      {
        offset: 50,
        stepType: 'VENDOR_RESULT_CHECK',
        displayName: '외주 결과 검수',
      },
    ],
  },
  {
    code: 'DAMAGE_RISK_APPROVAL_FLOW',
    displayName: '파손 위험 승인 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'DAMAGE_RISK_NOTICE',
        displayName: '파손 위험 고지',
      },
      {
        offset: 20,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 위험 승인 요청',
      },
      {
        offset: 30,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 응답 대기',
      },
      {
        offset: 40,
        stepType: 'APPLY_CUSTOMER_DECISION',
        displayName: '고객 결정 반영',
      },
    ],
  },
  {
    code: 'STAIN_REMOVAL_FAILED_FLOW',
    displayName: '오염 제거 실패 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'STAIN_FAILURE_NOTICE',
        displayName: '오염 제거 실패 안내',
      },
      {
        offset: 20,
        stepType: 'REQUEST_CUSTOMER_DECISION',
        displayName: '고객 후속 선택 요청',
      },
      {
        offset: 30,
        stepType: 'WAIT_CUSTOMER_DECISION',
        displayName: '고객 응답 대기',
      },
      {
        offset: 40,
        stepType: 'APPLY_CUSTOMER_DECISION',
        displayName: '고객 결정 반영',
      },
    ],
  },
  {
    code: 'PAYMENT_FAILED_FLOW',
    displayName: '결제 실패 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'PAYMENT_FAILED_NOTICE',
        displayName: '결제 실패 안내',
      },
      {
        offset: 20,
        stepType: 'WAIT_PAYMENT_RETRY',
        displayName: '결제 재시도 대기',
      },
      {
        offset: 30,
        stepType: 'APPLY_PAYMENT_DECISION',
        displayName: '결제 결과 반영',
      },
    ],
  },
  {
    code: 'PAYMENT_PENDING_FLOW',
    displayName: '미결제 보류 플로우',
    steps: [
      {
        offset: 10,
        stepType: 'PAYMENT_PENDING_HOLD',
        displayName: '미결제 보류',
      },
      {
        offset: 20,
        stepType: 'WAIT_PAYMENT_SUCCESS',
        displayName: '결제 완료 대기',
      },
      {
        offset: 30,
        stepType: 'RELEASE_DELIVERY_HOLD',
        displayName: '배송 보류 해제',
      },
    ],
  },
  {
    code: 'RETURN_WITHOUT_PROCESSING_FLOW',
    displayName: '미처리 반송 플로우',
    steps: [
      { offset: 10, stepType: 'STOP_PROCESSING', displayName: '작업 중단' },
      { offset: 20, stepType: 'RETURN_PREPARATION', displayName: '반송 준비' },
      {
        offset: 30,
        stepType: 'RETURN_DELIVERING',
        displayName: '반송 배송 중',
      },
      { offset: 40, stepType: 'RETURNED', displayName: '반송 완료' },
    ],
  },
];

async function seedExceptionFlowTemplates() {
  for (const flow of EXCEPTION_FLOW_SEEDS) {
    const upserted = await prisma.exceptionFlowTemplate.upsert({
      where: { code: flow.code },
      update: { displayName: flow.displayName, active: true },
      create: { code: flow.code, displayName: flow.displayName, active: true },
    });

    await prisma.exceptionFlowTemplateStep.deleteMany({
      where: { templateId: upserted.id },
    });

    for (const step of flow.steps) {
      await prisma.exceptionFlowTemplateStep.create({
        data: {
          templateId: upserted.id,
          stepType: step.stepType,
          offset: step.offset,
          displayName: step.displayName,
        },
      });
    }
  }
}

async function seedDeliveryVehicles() {
  const vehicles = [
    { code: 'DELIVERY_VAN_01', displayName: '배달 밴 1호' },
    { code: 'DELIVERY_VAN_02', displayName: '배달 밴 2호' },
    { code: 'DELIVERY_VAN_03', displayName: '배달 밴 3호' },
  ];

  for (const v of vehicles) {
    await prisma.deliveryVehicle.upsert({
      where: { code: v.code },
      update: { displayName: v.displayName, active: true },
      create: { code: v.code, displayName: v.displayName },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
