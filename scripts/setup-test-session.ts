/**
 * 테스트 세션 자동화 스크립트
 * 고객 로그인 → 주문 생성 → 픽업 런 → 공장 인계까지 자동 처리
 *
 * 사용법:
 *   npx ts-node --transpile-only scripts/setup-test-session.ts
 *   npx ts-node --transpile-only scripts/setup-test-session.ts --customer customer-2
 *   npx ts-node --transpile-only scripts/setup-test-session.ts --items shirt,sneakers
 */

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : fallback;
};

const CUSTOMER_ID = flag('customer', 'customer-1');
const PICKUP_STAFF = flag('staff', 'staff-1');
const WASH_STAFF = flag('wash-staff', 'wash-staff-1');
const VEHICLE_CODE = flag('vehicle', 'PICKUP-VAN-01');
const BAG_BARCODE_FLAG = flag('bag', '');
const RAW_ITEMS = flag('items', '');

type ItemOption = { groupCode: string; optionCode: string };
type ItemConfig = { itemCode: string; options: ItemOption[]; label: string };

// processing route 분기별 대표 아이템 (12개 route 전체 커버)
const ALL_ROUTE_ITEMS: ItemConfig[] = [
  {
    label: 'GENERAL_CLOTHES_CLEANING',
    itemCode: 'shirt',
    options: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
  },
  {
    label: 'REPAIR_AND_CLEANING',
    itemCode: 'shirt',
    options: [
      { groupCode: 'cleaning_method', optionCode: 'regular_wash' },
      { groupCode: 'repair', optionCode: 'sleeve_length_shortening' },
    ],
  },
  {
    label: 'PREMIUM_CLEANING',
    itemCode: 'shirt',
    options: [{ groupCode: 'cleaning_method', optionCode: 'premium_wash' }],
  },
  {
    label: 'REPAIR_AND_PREMIUM_CLEANING',
    itemCode: 'shirt',
    options: [
      { groupCode: 'cleaning_method', optionCode: 'premium_wash' },
      { groupCode: 'repair', optionCode: 'sleeve_length_shortening' },
    ],
  },
  {
    label: 'STANDARD_SHOES_CLEANING',
    itemCode: 'sneakers',
    options: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
  },
  {
    label: 'PREMIUM_SHOES_CLEANING',
    itemCode: 'sneakers',
    options: [{ groupCode: 'cleaning_method', optionCode: 'premium_wash' }],
  },
  {
    label: 'REPAIR_AND_SHOES_CLEANING',
    itemCode: 'sneakers',
    options: [
      { groupCode: 'cleaning_method', optionCode: 'regular_wash' },
      { groupCode: 'repair', optionCode: 'partial_sole_bonding' },
    ],
  },
  {
    label: 'REPAIR_AND_PREMIUM_SHOES_CLEANING',
    itemCode: 'sneakers',
    options: [
      { groupCode: 'cleaning_method', optionCode: 'premium_wash' },
      { groupCode: 'repair', optionCode: 'partial_sole_bonding' },
    ],
  },
  {
    label: 'OUTSOURCED_CLEANING',
    itemCode: 'ugg_boots',
    options: [
      { groupCode: 'cleaning_method', optionCode: 'regular_wash' },
      { groupCode: 'repair', optionCode: 'partial_sole_bonding' },
    ],
  },
  {
    label: 'OUTSOURCED_PREMIUM_SHOES_CLEANING',
    itemCode: 'ugg_boots',
    options: [
      { groupCode: 'cleaning_method', optionCode: 'premium_wash' },
      { groupCode: 'repair', optionCode: 'partial_sole_bonding' },
    ],
  },
  {
    label: 'OUTSOURCED_ONLY_CLEANING',
    itemCode: 'tent',
    options: [{ groupCode: 'material', optionCode: 'polyester_under_5m' }],
  },
  {
    label: 'QUICK_LAUNDRY',
    itemCode: 'quick_laundry',
    options: [
      {
        groupCode: 'cleaning_method',
        optionCode: 'water_wash_high_temperature_dry',
      },
    ],
  },
];

// --items 플래그로 단순 아이템 코드 지정 시 사용하는 최소 옵션
const MINIMAL_OPTIONS: Record<string, ItemOption[]> = {
  shirt: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
  pants: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
  accessory_shirt: [
    { groupCode: 'cleaning_method', optionCode: 'regular_wash' },
  ],
  sneakers: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
  ugg_boots: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
  tent: [{ groupCode: 'material', optionCode: 'polyester_under_5m' }],
  quick_laundry: [
    {
      groupCode: 'cleaning_method',
      optionCode: 'water_wash_high_temperature_dry',
    },
  ],
};

const orderItems: ItemConfig[] = RAW_ITEMS
  ? RAW_ITEMS.split(',').map((code) => {
      const c = code.trim();
      return { itemCode: c, label: c, options: MINIMAL_OPTIONS[c] ?? [] };
    })
  : ALL_ROUTE_ITEMS;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function postSafe(
  path: string,
  body: unknown,
  token: string,
): Promise<boolean> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function post<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 테스트 세션 설정 시작`);
  console.log(`   고객: ${CUSTOMER_ID}  |  아이템 ${orderItems.length}개\n`);
  orderItems.forEach((item, i) =>
    console.log(`   ${i + 1}. ${item.itemCode.padEnd(15)} → ${item.label}`),
  );
  console.log();

  // 1. 고객 로그인
  const { accessToken: customerToken } = await post<{ accessToken: string }>(
    '/auth/customer/dev-login',
    { customerId: CUSTOMER_ID },
  );
  console.log(`✅ 고객 로그인 완료`);

  // 2. 주문 생성
  const order = await post<{ id: string; estimatedMinAmount: number }>(
    '/orders',
    {
      customerId: CUSTOMER_ID,
      fulfillmentType: 'DELIVERY',
      fulfillmentOptionCode: 'regular_delivery',
      address: '서울시 강남구 테헤란로 1',
      phoneNumber: '010-0000-0000',
      pickupDeliveryPlaceCode: 'front_door',
      items: orderItems.map(({ itemCode, options }) => ({ itemCode, options })),
    },
    customerToken,
  );
  console.log(
    `✅ 주문 생성 완료  orderId=${order.id}  예상금액=${order.estimatedMinAmount.toLocaleString()}원`,
  );

  // 3. 픽업 직원 로그인
  const { accessToken: staffToken } = await post<{ accessToken: string }>(
    '/auth/staff/pickup/dev-login',
    { staffId: PICKUP_STAFF },
  );
  console.log(`✅ 픽업 직원 로그인 완료`);

  // 4. 픽업 런 생성
  const run = await post<{ runId: string }>(
    '/pickup/runs',
    { vehicleCode: VEHICLE_CODE },
    staffToken,
  );
  console.log(`✅ 픽업 런 생성 완료  runId=${run.runId}`);

  // 5. 사용 가능한 백 탐색 및 등록
  const candidates = BAG_BARCODE_FLAG
    ? [BAG_BARCODE_FLAG]
    : Array.from(
        { length: 10 },
        (_, i) => `PICKUP-BAG-${String(i + 1).padStart(3, '0')}`,
      );

  let bagBarcode = '';
  for (const barcode of candidates) {
    const ok = await postSafe(
      `/pickup/runs/${run.runId}/bags`,
      { bagBarcode: barcode },
      staffToken,
    );
    if (ok) {
      bagBarcode = barcode;
      break;
    }
  }
  if (!bagBarcode)
    throw new Error(
      '사용 가능한 픽업 백이 없습니다. DB를 리셋하거나 --bag 옵션으로 지정하세요.',
    );
  console.log(`✅ 백 등록 완료  bag=${bagBarcode}`);

  // 6. 주문 상세 조회 → itemId 목록 추출
  const orderDetail = await get<{ items: { itemId: string }[] }>(
    `/pickup/requests/${order.id}`,
    staffToken,
  );
  const itemIds = orderDetail.items.map((i) => i.itemId);

  // 7. 픽업 사진 기록
  await post(
    `/pickup/requests/${order.id}/photos`,
    { runId: run.runId, photoUrl: 'https://example.com/test-pickup-photo.jpg' },
    staffToken,
  );
  console.log(`✅ 픽업 사진 기록 완료`);

  // 8. 백에 아이템 담기
  await post(
    `/pickup/bags/${bagBarcode}/items`,
    { runId: run.runId, orderId: order.id, itemIds },
    staffToken,
  );
  console.log(`✅ 아이템 백 담기 완료  items=${itemIds.length}개`);

  // 9. 공장 인계
  await post(
    `/pickup/bags/${bagBarcode}/handoff`,
    { runId: run.runId },
    staffToken,
  );
  console.log(`✅ 공장 인계 완료  → 아이템 상태: IN_HOUSE\n`);

  // 10. 세탁 직원 로그인
  const { accessToken: washToken } = await post<{ accessToken: string }>(
    '/auth/staff/wash/dev-login',
    { staffId: WASH_STAFF },
  );
  console.log(`✅ 세탁 직원 로그인 완료`);

  // 11. 아이템별 태그 등록 (TAG-001 ~ TAG-012)
  for (let idx = 0; idx < itemIds.length; idx++) {
    const tagBarcode = `${idx + 1}`;
    await post(`/wash/items/${itemIds[idx]}/tag`, { tagBarcode }, washToken);
    console.log(`✅ 태그 등록  itemId=${itemIds[idx]}  tag=${tagBarcode}`);
  }
  console.log();

  console.log(`🎉 완료! wash-web에서 세탁 처리부터 시작하세요.`);
  console.log(`   orderId : ${order.id}`);
  console.log(`   itemIds : ${itemIds.join(', ')}\n`);
}

main().catch((err) => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
