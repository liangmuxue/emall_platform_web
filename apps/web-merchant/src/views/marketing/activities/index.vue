<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  DatePicker,
  Input,
  message,
  Modal,
  Radio,
  Table,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Activity = {
  activityNo?: string;
  end?: string;
  id: number;
  name: string;
  needsReview: boolean;
  reviewRemark?: string;
  scope: string;
  start?: string;
  status: string;
  statusName: string;
  summary: string;
  typeName: string;
};

type Sku = { id: number; name: string; price: string };
type Product = { categoryId: number; id: number; name: string; skus: Sku[] };
type SeckillRow = {
  checked: boolean;
  price: string;
  sale: string;
  skuId: number;
  spec: string;
  stock: string;
};

const rows = ref<Activity[]>([]);
const filter = ref('ALL');
const keyword = ref('');
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const categories = ref<{ id: number; name: string }[]>([]);
const products = ref<Product[]>([]);
const form = reactive({
  name: '',
  type: '满减',
  scope: '全店',
  scopeIds: [] as number[],
  start: '',
  end: '',
  threshold: '39',
  cut: '5',
  reductionMode: '满一次减',
  couponAmount: '5',
  couponMin: '39',
  couponQty: '100',
  couponLimit: '1',
  discountMode: '统一折扣',
  rate: '8',
  discountLimit: '2',
  stack: '不可与优惠券同享',
  tierQty: '2',
  tierRate: '8',
  slot: '10:00',
  seckillLimit: '2',
  seckill: [] as SeckillRow[],
});

const columns: TableColumnsType<Activity> = [
  { title: '活动', key: 'activity' },
  { title: '规则', key: 'summary', width: 220 },
  { title: '状态', key: 'status', width: 150 },
  { title: '操作', key: 'action', width: 110 },
];

const types = [
  { name: '满减', tone: 'cut', line: '订单满额减免', mark: '减' },
  { name: '优惠券', tone: 'coupon', line: '顾客领券抵扣', mark: '券' },
  { name: '折扣', tone: 'off', line: '指定商品打折', mark: '折' },
  { name: '秒杀', tone: 'flash', line: '限时特价抢购', mark: '秒' },
];

const counts = computed(() => ({
  active: rows.value.filter((item) => item.status === 'ACTIVE').length,
  ended: rows.value.filter((item) => item.status === 'ENDED').length,
  pending: rows.value.filter((item) => item.status === 'PENDING').length,
}));
const visible = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter((item) => {
    if (filter.value !== 'ALL' && item.status !== filter.value) return false;
    if (!query) return true;
    return [item.name, item.summary, item.typeName, item.activityNo, item.scope]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
});
const fixedProduct = computed(
  () => form.type === '折扣' || form.type === '秒杀',
);
const needsReview = computed(
  () => form.type === '优惠券' || form.type === '秒杀',
);
const typeTone = computed(
  () => types.find((item) => item.name === form.type)?.tone || 'cut',
);
const nameHolder = computed(() => {
  if (form.type === '优惠券') return '例如：生鲜满减券';
  if (form.type === '折扣') return '例如：蔬菜 8 折';
  if (form.type === '秒杀') return '例如：晚间秒杀';
  return '例如：满 39 减 5';
});
const preview = computed(() => {
  if (form.type === '满减') {
    const mode = form.reductionMode === '每满一次减' ? '每满' : '满';
    return `${mode} ${form.threshold || '—'} 元减 ${form.cut || '—'} 元`;
  }
  if (form.type === '优惠券') {
    const min =
      Number(form.couponMin) > 0 ? `满 ${form.couponMin} 元可用` : '无门槛';
    return `${form.couponAmount || '—'} 元券 · ${min}`;
  }
  if (form.type === '折扣') {
    return form.discountMode === '多件折扣'
      ? `满 ${form.tierQty || '—'} 件打 ${form.tierRate || '—'} 折`
      : `统一 ${form.rate || '—'} 折`;
  }
  const picked = form.seckill.filter((item) => item.checked).length;
  return `${form.slot || '未设场次'} 场 · 已选 ${picked} 个规格`;
});
const typeHint = computed(() =>
  needsReview.value
    ? '提交后进入平台审核，通过后顾客才能使用。'
    : '提交后立即生效，顾客结算时自动计算。',
);
const seckillGroups = computed(() => {
  const chosen = new Set(form.scopeIds);
  return products.value
    .filter((product) => chosen.has(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      skus: form.seckill.filter((sku) =>
        product.skus.some((row) => row.id === sku.skuId),
      ),
    }));
});

function typeOf(name: string) {
  return (
    types.find((item) => item.name === name) || {
      mark: name.slice(0, 1) || '活',
      name,
      tone: 'cut',
      line: '',
    }
  );
}

function period(item: Activity | Record<string, any>) {
  const start = (item.start || '').slice(5, 16);
  const end = (item.end || '').slice(5, 16);
  return start && end ? `${start} 至 ${end}` : '时间未设置';
}

function chosen(id: number) {
  return form.scopeIds.includes(id);
}

function toggleId(id: number) {
  const index = form.scopeIds.indexOf(id);
  if (index === -1) {
    form.scopeIds.push(id);
    return;
  }
  form.scopeIds.splice(index, 1);
}

function pickType(name: string) {
  if (form.type === name) return;
  form.type = name;
  if ((name === '折扣' || name === '秒杀') && form.scope !== '指定商品') {
    form.scope = '指定商品';
    form.scopeIds = [];
  }
}

function pickScope(scope: string) {
  if (fixedProduct.value || form.scope === scope) return;
  form.scope = scope;
  form.scopeIds = [];
}

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Activity[]>('/activities');
  } finally {
    loading.value = false;
  }
}

async function openCreate() {
  const options = await requestClient.get<{
    categories: { id: number; name: string }[];
    products: Product[];
  }>('/activities/options');
  categories.value = options.categories;
  products.value = options.products;
  form.name = '';
  form.type = '满减';
  form.scope = '全店';
  form.scopeIds = [];
  form.start = '';
  form.end = '';
  form.seckill = products.value.flatMap((product) =>
    product.skus.map((sku) => ({
      checked: false,
      price: '',
      sale: sku.price,
      skuId: sku.id,
      spec: sku.name,
      stock: '',
    })),
  );
  open.value = true;
}

function activityRule(): Record<string, unknown> {
  if (form.type === '满减') {
    return {
      threshold: form.threshold,
      cut: form.cut,
      mode: form.reductionMode,
    };
  }
  if (form.type === '优惠券') {
    return {
      amount: form.couponAmount,
      min: form.couponMin,
      qty: Number(form.couponQty),
      limit: Number(form.couponLimit),
    };
  }
  if (form.type === '折扣' && form.discountMode === '多件折扣') {
    return {
      mode: '多件折扣',
      limit: Number(form.discountLimit),
      stack: form.stack,
      tiers: [{ qty: Number(form.tierQty), rate: Number(form.tierRate) }],
    };
  }
  if (form.type === '折扣') {
    return {
      mode: '统一折扣',
      rate: Number(form.rate),
      limit: Number(form.discountLimit),
      stack: form.stack,
    };
  }
  return { slot: form.slot, limit: Number(form.seckillLimit) };
}

async function save() {
  const rule = activityRule();
  const items = form.seckill
    .filter((item) => item.checked)
    .map((item) => ({
      skuId: item.skuId,
      price: item.price,
      stock: Number(item.stock),
    }));
  saving.value = true;
  try {
    const created = await requestClient.post<{ id: number }>('/activities', {
      name: form.name,
      type: form.type,
      scope: fixedProduct.value ? '指定商品' : form.scope,
      scopeIds:
        form.scope === '全店' && !fixedProduct.value ? [] : form.scopeIds,
      start: form.start,
      end: form.end,
      rule,
      items,
    });
    await requestClient.post(`/activities/${created.id}/submit`);
    message.success(
      form.type === '优惠券' || form.type === '秒杀'
        ? '已提交，等待平台审核'
        : '活动已生效',
    );
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function finish(id: number) {
  await requestClient.post(`/activities/${id}/end`);
  message.success('活动已结束');
  await load();
}

onMounted(load);
</script>

<template>
  <Page
    description="满减和折扣提交后直接生效。优惠券和秒杀需要平台审核。结算顺序是商品金额、折扣或秒杀、满减、优惠券、积分。"
    title="营销活动"
  >
    <template #extra>
      <Button type="primary" @click="openCreate">新建活动</Button>
    </template>
    <div class="board">
      <button
        class="metric sale"
        :class="{ on: filter === 'ACTIVE' }"
        type="button"
        @click="filter = 'ACTIVE'"
      >
        <span>进行中</span>
        <b>{{ counts.active }}</b>
        <small>顾客结算时会自动计算</small>
      </button>
      <button
        class="metric warn"
        :class="{ on: filter === 'PENDING' }"
        type="button"
        @click="filter = 'PENDING'"
      >
        <span>待审核</span>
        <b>{{ counts.pending }}</b>
        <small>优惠券和秒杀通过后才生效</small>
      </button>
      <button
        class="metric pending"
        :class="{ on: filter === 'ENDED' }"
        type="button"
        @click="filter = 'ENDED'"
      >
        <span>已结束</span>
        <b>{{ counts.ended }}</b>
        <small>结束后不再参与结算</small>
      </button>
      <Card class="panel">
        <div class="toolbar">
          <Input
            v-model:value="keyword"
            allow-clear
            class="search"
            placeholder="搜索活动名称、规则或编号"
          />
          <Radio.Group v-model:value="filter" button-style="solid">
            <Radio.Button value="ALL">全部</Radio.Button>
            <Radio.Button value="ACTIVE">进行中</Radio.Button>
            <Radio.Button value="PENDING">待审核</Radio.Button>
            <Radio.Button value="REJECTED">已驳回</Radio.Button>
            <Radio.Button value="ENDED">已结束</Radio.Button>
          </Radio.Group>
          <Button class="refresh" @click="load">刷新</Button>
        </div>
        <Table
          class="list"
          :columns="columns"
          :data-source="visible"
          :loading="loading"
          :pagination="{
            pageSize: 8,
            showTotal: (total: number) => `共 ${total} 个活动`,
          }"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'activity'">
              <div class="activity">
                <i class="mark" :class="typeOf(record.typeName).tone">{{
                  typeOf(record.typeName).mark
                }}</i>
                <div class="copy">
                  <b>{{ record.name }}</b>
                  <small>{{ typeOf(record.typeName).name }} · {{ record.scope }} ·
                    {{ record.activityNo || '未编号' }}</small>
                  <small>{{ period(record) }}</small>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'summary'">
              <b class="rule-text">{{ record.summary || '未设置规则' }}</b>
            </template>
            <template v-else-if="column.key === 'status'">
              <div class="state-cell">
                <span class="state" :class="record.status">
                  <i></i>
                  {{ record.statusName }}
                </span>
                <p
                  v-if="record.status === 'REJECTED' && record.reviewRemark"
                  class="state-note"
                >
                  {{ record.reviewRemark }}
                </p>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                v-if="record.status === 'ACTIVE'"
                size="small"
                type="link"
                @click="finish(record.id)"
              >
                结束
              </Button>
              <span v-else class="idle">—</span>
            </template>
          </template>
        </Table>
      </Card>
    </div>
    <Modal
      v-model:open="open"
      :footer="null"
      :title="null"
      width="820px"
      wrap-class-name="act-modal"
    >
      <div class="sheet">
        <header class="hero" :class="typeTone">
          <div>
            <span>新建活动 · {{ form.type }}</span>
            <b>{{ form.name.trim() || preview }}</b>
            <p>{{ typeHint }}</p>
          </div>
          <em>{{ needsReview ? '需平台审核' : '提交即生效' }}</em>
        </header>
        <div class="sheet-body">
          <section class="type-grid">
            <button
              v-for="item in types"
              :key="item.name"
              class="type"
              :class="[item.tone, { on: form.type === item.name }]"
              type="button"
              @click="pickType(item.name)"
            >
              <i>{{ item.mark }}</i>
              <span>
                <b>{{ item.name }}</b>
                <small>{{ item.line }}</small>
              </span>
            </button>
          </section>

          <section class="block">
            <header>
              <b>基本信息</b>
              <span>名称和生效时间</span>
            </header>
            <div class="block-body">
              <label>活动名称<Input
                  v-model:value="form.name"
                  :placeholder="nameHolder"
              /></label>
              <div class="pair">
                <label>
                  开始时间
                  <DatePicker
                    v-model:value="form.start"
                    class="full"
                    format="YYYY-MM-DD HH:mm"
                    placeholder="开始时间"
                    show-time
                    value-format="YYYY-MM-DD HH:mm"
                  />
                </label>
                <label>
                  结束时间
                  <DatePicker
                    v-model:value="form.end"
                    class="full"
                    format="YYYY-MM-DD HH:mm"
                    placeholder="结束时间"
                    show-time
                    value-format="YYYY-MM-DD HH:mm"
                  />
                </label>
              </div>
            </div>
          </section>

          <section class="block">
            <header>
              <b>适用范围</b>
              <span>{{
                fixedProduct ? '折扣和秒杀必须选择具体商品' : form.scope
              }}</span>
            </header>
            <div class="block-body">
              <div v-if="!fixedProduct" class="chips">
                <button
                  class="chip"
                  :class="{ on: form.scope === '全店' }"
                  type="button"
                  @click="pickScope('全店')"
                >
                  全店
                </button>
                <button
                  class="chip"
                  :class="{ on: form.scope === '指定类目' }"
                  type="button"
                  @click="pickScope('指定类目')"
                >
                  指定类目
                </button>
                <button
                  class="chip"
                  :class="{ on: form.scope === '指定商品' }"
                  type="button"
                  @click="pickScope('指定商品')"
                >
                  指定商品
                </button>
              </div>
              <p v-else class="help">
                勾选参与本次活动的在售商品。未上架的商品不会出现在这里。
              </p>
              <div
                v-if="form.scope === '指定类目' && !fixedProduct"
                class="chips"
              >
                <button
                  v-for="item in categories"
                  :key="item.id"
                  class="chip"
                  :class="{ on: chosen(item.id) }"
                  type="button"
                  @click="toggleId(item.id)"
                >
                  {{ item.name }}
                </button>
                <span v-if="!categories.length" class="help">暂无可选类目</span>
              </div>
              <div
                v-if="form.scope === '指定商品' || fixedProduct"
                class="chips"
              >
                <button
                  v-for="item in products"
                  :key="item.id"
                  class="chip"
                  :class="{ on: chosen(item.id) }"
                  type="button"
                  @click="toggleId(item.id)"
                >
                  {{ item.name }}
                  <small>{{ item.skus.length }} 个规格</small>
                </button>
                <span v-if="!products.length" class="help">当前没有在售商品</span>
              </div>
            </div>
          </section>

          <section class="block rule" :class="typeTone">
            <header>
              <b>优惠规则</b>
              <span>{{ preview }}</span>
            </header>
            <div class="block-body">
              <template v-if="form.type === '满减'">
                <div class="sentence">
                  <span>{{
                    form.reductionMode === '每满一次减' ? '每满' : '满'
                  }}</span>
                  <Input v-model:value="form.threshold" />
                  <span>元，减</span>
                  <Input v-model:value="form.cut" />
                  <span>元</span>
                </div>
                <div class="choices">
                  <button
                    class="choice"
                    :class="{ on: form.reductionMode === '满一次减' }"
                    type="button"
                    @click="form.reductionMode = '满一次减'"
                  >
                    <b>满一次减</b>
                    <small>一笔订单只减一次</small>
                  </button>
                  <button
                    class="choice"
                    :class="{ on: form.reductionMode === '每满一次减' }"
                    type="button"
                    @click="form.reductionMode = '每满一次减'"
                  >
                    <b>每满一次减</b>
                    <small>金额每过一档就再减一次</small>
                  </button>
                </div>
              </template>

              <template v-else-if="form.type === '优惠券'">
                <div class="sentence">
                  <span>满</span>
                  <Input v-model:value="form.couponMin" />
                  <span>元，抵</span>
                  <Input v-model:value="form.couponAmount" />
                  <span>元</span>
                </div>
                <div class="pair">
                  <label>发放数量<Input v-model:value="form.couponQty" /></label>
                  <label>每人限领<Input v-model:value="form.couponLimit" /></label>
                </div>
                <p class="help">
                  顾客结算时如果还没领，会自动领取并使用。可用时间与活动时间相同。
                </p>
              </template>

              <template v-else-if="form.type === '折扣'">
                <div class="choices">
                  <button
                    class="choice"
                    :class="{ on: form.discountMode === '统一折扣' }"
                    type="button"
                    @click="form.discountMode = '统一折扣'"
                  >
                    <b>统一折扣</b>
                    <small>买多少件都按同一个折扣</small>
                  </button>
                  <button
                    class="choice"
                    :class="{ on: form.discountMode === '多件折扣' }"
                    type="button"
                    @click="form.discountMode = '多件折扣'"
                  >
                    <b>多件折扣</b>
                    <small>件数达到门槛再打折</small>
                  </button>
                </div>
                <div v-if="form.discountMode === '统一折扣'" class="sentence">
                  <span>打</span>
                  <Input v-model:value="form.rate" />
                  <span>折，每人限</span>
                  <Input v-model:value="form.discountLimit" />
                  <span>件</span>
                </div>
                <div v-else class="sentence">
                  <span>满</span>
                  <Input v-model:value="form.tierQty" />
                  <span>件，打</span>
                  <Input v-model:value="form.tierRate" />
                  <span>折，每人限</span>
                  <Input v-model:value="form.discountLimit" />
                  <span>件</span>
                </div>
                <p class="help">
                  填写 8 表示 8 折。件数从 2 起，折扣在 1 到 9.9 之间。
                </p>
                <div class="choices">
                  <button
                    class="choice"
                    :class="{ on: form.stack === '可与优惠券同享' }"
                    type="button"
                    @click="form.stack = '可与优惠券同享'"
                  >
                    <b>可与优惠券同享</b>
                    <small>打折后再用券</small>
                  </button>
                  <button
                    class="choice"
                    :class="{ on: form.stack === '不可与优惠券同享' }"
                    type="button"
                    @click="form.stack = '不可与优惠券同享'"
                  >
                    <b>不可与优惠券同享</b>
                    <small>用了折扣就不能再用券</small>
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="pair">
                  <label>秒杀场次<Input
                      v-model:value="form.slot"
                      placeholder="10:00"
                  /></label>
                  <label>每人限购<Input v-model:value="form.seckillLimit" /></label>
                </div>
                <p v-if="!seckillGroups.length" class="help">
                  先在上面勾选参与秒杀的商品，再填写每个规格的秒杀价和库存。
                </p>
                <div
                  v-for="group in seckillGroups"
                  :key="group.id"
                  class="sku-group"
                >
                  <b>{{ group.name }}</b>
                  <article
                    v-for="item in group.skus"
                    :key="item.skuId"
                    class="sku"
                    :class="{ on: item.checked }"
                  >
                    <button
                      :aria-label="`选择 ${item.spec}`"
                      class="tick"
                      :class="{ on: item.checked }"
                      type="button"
                      @click="item.checked = !item.checked"
                    ></button>
                    <div class="sku-copy">
                      <b>{{ item.spec }}</b>
                      <small>售价 ¥{{ item.sale }}</small>
                    </div>
                    <Input v-model:value="item.price" placeholder="秒杀价" />
                    <Input v-model:value="item.stock" placeholder="秒杀库存" />
                  </article>
                </div>
              </template>
            </div>
          </section>
        </div>
        <footer class="sheet-foot">
          <p>
            {{
              needsReview
                ? '优惠券和秒杀通过审核后才会生效。'
                : '满减和折扣保存后马上可以参与结算。'
            }}
          </p>
          <div>
            <Button @click="open = false">取消</Button>
            <Button :loading="saving" type="primary" @click="save">
              提交活动
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.panel {
  grid-column: 1 / -1;
  overflow: hidden;
  border-radius: 14px;
}

.metric {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  min-height: 112px;
  padding: 18px 20px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  isolation: isolate;
}

.metric::before,
.metric::after {
  position: absolute;
  pointer-events: none;
  content: '';
}

.metric::before {
  inset: 0;
  z-index: -1;
}

.metric::after {
  top: -36px;
  right: -28px;
  z-index: -1;
  width: 120px;
  height: 120px;
  border-radius: 50%;
}

.metric.sale::before {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 28%),
    hsl(var(--card)) 58%
  );
}

.metric.sale::after {
  background: radial-gradient(
    circle,
    hsl(var(--primary) / 42%),
    transparent 68%
  );
}

.metric.warn::before {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 26%),
    hsl(var(--card)) 58%
  );
}

.metric.warn::after {
  background: radial-gradient(
    circle,
    hsl(var(--warning) / 40%),
    transparent 68%
  );
}

.metric.pending::before {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 24%),
    hsl(var(--card)) 58%
  );
}

.metric.pending::after {
  background: radial-gradient(
    circle,
    hsl(var(--success) / 38%),
    transparent 68%
  );
}

.metric b {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--foreground));
  letter-spacing: -0.03em;
}

.metric span {
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.metric small {
  max-width: 16em;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}

.metric.sale.on {
  border-color: hsl(var(--primary) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 16%);
}

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.warn.on {
  border-color: hsl(var(--warning) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--warning) / 16%);
}

.metric.warn b {
  color: hsl(var(--warning));
}

.metric.pending.on {
  border-color: hsl(var(--success) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--success) / 16%);
}

.metric.pending b {
  color: hsl(var(--success));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 4px 4px 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid hsl(var(--border));
}

.search {
  width: 280px;
}

.refresh {
  margin-left: auto;
}

.activity {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 280px;
}

.mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  font-style: normal;
  font-weight: 750;
  border-radius: 12px;
}

.mark.cut {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 16%);
}

.mark.coupon {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 18%);
}

.mark.off {
  color: hsl(var(--success));
  background: hsl(var(--success) / 16%);
}

.mark.flash {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 16%);
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.copy b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 650;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.copy small,
.idle {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.rule-text {
  font-weight: 650;
  color: hsl(var(--foreground));
}

.state-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.state {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  height: 28px;
  padding: 0 12px 0 10px;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.state i {
  width: 7px;
  height: 7px;
  background: currentcolor;
  border-radius: 50%;
}

.state.ACTIVE {
  color: hsl(var(--success));
  background: hsl(var(--success) / 14%);
  border-color: hsl(var(--success) / 40%);
}

.state.ACTIVE i {
  box-shadow: 0 0 0 3px hsl(var(--success) / 22%);
}

.state.PENDING {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 14%);
  border-color: hsl(var(--warning) / 45%);
}

.state.PENDING i {
  box-shadow: 0 0 0 3px hsl(var(--warning) / 22%);
}

.state.REJECTED {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 12%);
  border-color: hsl(var(--destructive) / 45%);
}

.state.REJECTED i {
  box-shadow: 0 0 0 3px hsl(var(--destructive) / 20%);
}

.state-note {
  max-width: 12em;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--destructive));
}

.sheet {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
}

.hero {
  display: flex;
  flex: none;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 56px 18px 22px;
}

.hero.cut {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 28%),
    hsl(var(--card)) 68%
  );
}

.hero.coupon {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 26%),
    hsl(var(--card)) 68%
  );
}

.hero.off {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 24%),
    hsl(var(--card)) 68%
  );
}

.hero.flash {
  background: linear-gradient(
    145deg,
    hsl(var(--destructive) / 24%),
    hsl(var(--card)) 68%
  );
}

.hero span,
.hero p {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.hero b {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  color: hsl(var(--foreground));
  letter-spacing: -0.02em;
}

.hero p {
  margin: 6px 0 0;
}

.hero em {
  flex: none;
  padding: 4px 10px;
  margin-top: 4px;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  color: hsl(var(--foreground));
  background: hsl(var(--card) / 80%);
  border-radius: 999px;
}

.sheet-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 16px 22px 8px;
  overflow: auto;
}

.sheet-body > * {
  flex: none;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.type {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.type i {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  font-style: normal;
  font-weight: 750;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-radius: 12px;
}

.type span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.type b {
  font-size: 14px;
}

.type small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.type.cut.on {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 16%),
    hsl(var(--card)) 70%
  );
  border-color: hsl(var(--primary) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 14%);
}

.type.cut.on i {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

.type.coupon.on {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 16%),
    hsl(var(--card)) 70%
  );
  border-color: hsl(var(--warning) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--warning) / 14%);
}

.type.coupon.on i {
  color: hsl(var(--warning-foreground, var(--card)));
  background: hsl(var(--warning));
}

.type.off.on {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 16%),
    hsl(var(--card)) 70%
  );
  border-color: hsl(var(--success) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--success) / 14%);
}

.type.off.on i {
  color: hsl(var(--success-foreground, var(--card)));
  background: hsl(var(--success));
}

.type.flash.on {
  background: linear-gradient(
    145deg,
    hsl(var(--destructive) / 16%),
    hsl(var(--card)) 70%
  );
  border-color: hsl(var(--destructive) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--destructive) / 14%);
}

.type.flash.on i {
  color: hsl(var(--destructive-foreground, var(--card)));
  background: hsl(var(--destructive));
}

.block {
  flex: none;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 10%),
    hsl(var(--card)) 48px
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.block.rule.coupon {
  background: linear-gradient(
    180deg,
    hsl(var(--warning) / 12%),
    hsl(var(--card)) 48px
  );
}

.block.rule.off {
  background: linear-gradient(
    180deg,
    hsl(var(--success) / 12%),
    hsl(var(--card)) 48px
  );
}

.block.rule.flash {
  background: linear-gradient(
    180deg,
    hsl(var(--destructive) / 12%),
    hsl(var(--card)) 48px
  );
}

.block header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px 8px;
}

.block header span,
.help {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.help {
  margin: 0;
  line-height: 1.5;
}

.block-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 14px 14px;
}

.block-body label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: hsl(var(--foreground));
}

.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full {
  width: 100%;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 12px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.chip small {
  color: hsl(var(--muted-foreground));
}

.chip.on {
  font-weight: 650;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-color: hsl(var(--primary) / 60%);
}

.chip.on small {
  color: hsl(var(--primary));
}

.sentence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-radius: 12px;
}

.sentence :deep(.ant-input) {
  width: 88px;
  font-weight: 700;
  text-align: center;
}

.choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.choice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.choice small {
  color: hsl(var(--muted-foreground));
}

.choice.on {
  background: linear-gradient(
    90deg,
    hsl(var(--primary) / 14%),
    hsl(var(--card)) 58%
  );
  border-color: hsl(var(--primary) / 60%);
}

.sku-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sku-group > b {
  font-size: 13px;
}

.sku {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 110px 110px;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.sku.on {
  background: linear-gradient(
    90deg,
    hsl(var(--destructive) / 10%),
    hsl(var(--card)) 46%
  );
  border-color: hsl(var(--destructive) / 45%);
}

.tick {
  width: 18px;
  height: 18px;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1.5px solid hsl(var(--border));
  border-radius: 6px;
}

.tick.on {
  background: hsl(var(--destructive));
  border-color: hsl(var(--destructive));
  box-shadow: inset 0 0 0 3px hsl(var(--card));
}

.sku-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sku-copy b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sku-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.sheet-foot {
  display: flex;
  flex: none;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.sheet-foot p {
  margin: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sheet-foot div {
  display: flex;
  gap: 8px;
}
</style>

<style>
.act-modal .ant-modal {
  top: 24px;
  padding-bottom: 0;
}

.act-modal .ant-modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 18px;
}

.act-modal .ant-modal-header {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

.act-modal .ant-modal-title {
  display: none;
}

.act-modal .ant-modal-body {
  padding: 0;
}

.act-modal .ant-modal-close {
  color: hsl(var(--foreground));
}
</style>
