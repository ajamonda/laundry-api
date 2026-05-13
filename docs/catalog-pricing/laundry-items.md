# Laundry Item Catalog Details

This document summarizes the exported reference document `세탁물 정보`. It is the backend-readable baseline for catalog seed data, frontend option rendering, server-side validation, and estimated pricing.

## Conventions

- API and DB codes use English `snake_case`.
- Client display names, option names, washing notices, and user-facing labels use Korean.
- Prices are KRW integer amounts.
- `fixed` prices can be calculated immediately.
- `range` prices should return estimated minimum and maximum amounts until the factory confirms the final price.
- `unit` prices require an input value, such as weight.
- `matrix` prices depend on a combination of selected attributes, such as tent material and size band.
- `text_input` values are customer-entered strings stored with the order item or order request.

Suggested option group codes:

- `cleaning_method`: 세탁 방법
- `additional_care`: 추가 케어
- `repair`: 수선
- `material`: 재질
- `size_band`: 크기 구간
- `washing_notice`: 세탁시 유의사항
- `item_characteristics`: 세탁물 특징
- `bag_characteristics`: 가방 특징
- `fulfillment`: 배송 혹은 보관
- `pickup_delivery_place`: 수거/배송 장소
- `second_hand_pickup`: 헌옷 수거 여부

## Laundry Items

### `shirt`

Display name: `셔츠`

Cleaning methods:

- `regular_wash`: 일반 세탁, fixed price `2400`
- `premium_wash`: 프리미엄 세탁, fixed price `25000`
- `deodorize_wrinkle_care`: 탈취구김 케어, fixed price `1765`

Additional care:

- `stain_care`: 얼룩 케어, range price `2900-4900`
- `lint_care`: 보풀 케어, range price `0-3000`
- `hand_ironing`: 손다림질, fixed price `1800`

Repair:

- `sleeve_arm_repair`: 소매, 팔 수선
  - `sleeve_length_shortening`: 소매기장 줄임, fixed price `15000`
  - `sleeve_width_narrowing`: 소매통 줄임, fixed price `13000`
- `pulled_thread_repair`: 올뜯김 수선
  - `pulled_thread_under_1cm`: 올뜯김 수선 1cm 이하, fixed price `25000`
  - `pulled_thread_extra_per_0_5cm`: 올뜯김 수선 추가 초과 0.5cm 당, unit price `10000`

### `pants`

Display name: `바지`

Cleaning methods:

- `regular_wash`: 일반 세탁, fixed price `5500`
- `premium_wash`: 프리미엄 세탁, fixed price `30000`
- `deodorize_wrinkle_care`: 탈취구김 케어, fixed price `1765`

Additional care:

- `stain_care`: 얼룩 케어, range price `2900-4900`
- `lint_care`: 보풀 케어, range price `0-3000`

Repair:

- `length_repair`: 기장 수선
  - `length_shortening`: 기장 줄임, fixed price `6000`
  - `length_extension`: 기장 늘림, fixed price `7000`
- `pulled_thread_repair`: 올뜯김 수선
  - `pulled_thread_under_1cm`: 올뜯김 수선 1cm 이하, fixed price `25000`
  - `pulled_thread_extra_per_0_5cm`: 올뜯김 수선 추가 초과 0.5cm 당, unit price `10000`

### `sneakers`

Display name: `운동화`

Cleaning methods:

- `regular_wash`: 일반 세탁, fixed price `6900`
- `premium_wash`: 프리미엄 세탁, fixed price `35000`

Additional care:

- `stain_care`: 얼룩 케어, range price `2900-4900`
- `lint_care`: 보풀 케어, range price `0-3000`

Repair:

- `sole_repair`: 밑창 수선
  - `partial_sole_bonding`: 부분 밑창 접착, fixed price `25000`
  - `full_sole_bonding`: 전체 밑창 접착, fixed price `29000`
- `heel_outsole_repair`: 뒤꿈치, 아웃솔 수선
  - `heel_fabric_replacement`: 뒤꿈치 원단 교체, fixed price `39000`
  - `outsole_discoloration_restore`: 아웃솔 변색 복원, fixed price `19000`

Washing notice options:

- `fragile_material`: 쉽게 손상되는 소재예요
- `accessory_detachment`: 부속품이 떨어질 수 있어요

### `ugg_boots`

Display name: `어그부츠`

Item characteristics:

- `characteristics_text`: 세탁물 특징, text input

Cleaning methods:

- `regular_wash`: 일반 세탁, fixed price `20000`
- `premium_wash`: 프리미엄 세탁, fixed price `50000`

Additional care:

- `stain_care`: 얼룩 케어, range price `2900-4900`
- `lint_care`: 보풀 케어, range price `0-3000`
- `water_repellent_coating`: 발수코팅, fixed price `5000`

Repair:

- `sole_repair`: 밑창 수선
  - `partial_sole_bonding`: 부분 밑창 접착, fixed price `25000`
  - `full_sole_bonding`: 전체 밑창 접착, fixed price `29000`
- `heel_outsole_repair`: 뒤꿈치, 아웃솔 수선
  - `heel_fabric_replacement`: 뒤꿈치 원단 교체, fixed price `39000`
  - `outsole_discoloration_restore`: 아웃솔 변색 복원, fixed price `19000`

Washing notice options:

- `fragile_material`: 쉽게 손상되는 소재예요
- `accessory_detachment`: 부속품이 떨어질 수 있어요

### `accessory_shirt`

Display name: `악세사리가 달린 셔츠`

This item uses the same option structure as `shirt`.

Inherited option groups:

- 세탁 방법
- 사진
- 추가 케어
- 수선

### `tent`

Display name: `텐트`

Tent base pricing is a material and size matrix.

Material and size prices:

- `polyester`: 폴리
  - `polyester_under_5m`: 5m 미만, fixed price `65000`
  - `polyester_from_5m_to_under_6m`: 5m 이상 6m 미만, fixed price `80000`
- `cotton`: 면
  - `cotton_under_5m`: 5m 미만, fixed price `125000`
  - `cotton_from_5m_to_under_6m`: 5m 이상 6m 미만, fixed price `135000`

Additional care:

- `water_repellent_coating`: 발수코팅, fixed price `30000`
- `mold_removal`: 곰팡이 제거, fixed price `20000`

### `quick_laundry`

Display name: `생활 빨래`

Cleaning methods:

- `water_wash_high_temperature_dry`: 물세탁 후 고온건조

Additional care:

- `underwear_separate_wash`: 속옷 분리 세탁, fixed price `1000`
- `natural_detergent`: 천연 세제, unit price
  - Base price: `3600`
  - Base amount: up to `3kg`
  - Extra unit: every additional `0.5kg`
  - Extra unit price: `600`

Bag characteristics:

- `bag_characteristics_text`: 가방 특징, text input

## Order Request Fields

These fields are part of the final laundry request, not a single laundry item.

Pickup schedule:

- `pickup_schedule`: 수거일정

Fulfillment:

- `delivery`: 배송
  - `economy_delivery`: 알뜰배송
  - `fast_delivery`: 빠른배송
  - `regular_delivery`: 일반배송
- `storage`: 보관
  - `storage_3_months`: 3개월 보관
  - `storage_6_months`: 6개월 보관

Customer and address:

- `address`: 주소
- `phone_number`: 휴대폰 번호
- Prototype note: 휴대폰 번호 can be replaced by the user id during simplified login.

Pickup or delivery place:

- `front_door`: 문 앞
- `security_office`: 경비실 보관
- `custom_place_text`: 직접 입력하기, text input

Second-hand pickup:

- `second_hand_pickup_requested`: 헌옷 수거 여부

## Backend Notes

- The frontend can repeat item selection locally and send the full cart to `POST /pricing/estimate`.
- The server should validate every item code, option group, nested option, and required input.
- The server should calculate immediate fixed totals and estimated min/max totals for range-priced selections.
- Order creation should store selected option codes, customer text inputs, photo references, and price snapshots.
