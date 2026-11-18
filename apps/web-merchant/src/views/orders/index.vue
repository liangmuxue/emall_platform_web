<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  message,
  Modal,
  Radio,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type OrderItem = {
  amount: string;
  imageUrl?: string;
  name: string;
  price: string;
  quantity: number;
  spec: string;
};

type Order = {
  action: string;
  activityAmount?: string;
  actionName: string;
  buyer: string;
  couponAmount?: string;
  destinationAddress?: string;
  destinationName: string;
  destinationPhone?: string;
  fulfillmentText: string;
  fullReductionAmount?: string;
  goods: string;
  goodsAmount?: string;
  goodsQty: number;
  id: number;
  items?: OrderItem[];
  mobile: string;
  orderNo: string;
  payableAmount: string;
  pickupCodeText: string;
  pointAmount?: string;
  pointsUsed?: number;
  remark?: string;
  status: string;
  statusName: string;
};

const rows = ref<Order[]>([]);
const filter = ref('ALL');
const loading = ref(false);
const acting = ref(false);
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<null | Order>(null);

const columns: TableColumnsType<Order> = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 220 },
  { title: '商品', dataIndex: 'goods', key: 'goods' },
  { title: '顾客', key: 'buyer', width: 160 },
  { title: '自提点', key: 'point', width: 180 },
  { title: '金额', dataIndex: 'payableAmount', key: 'amount', width: 100 },
  { title: '状态', key: 'status', width: 110 },
  { title: '取件码', key: 'code', width: 120 },
  { title: '操作', key: 'action', width: 120 },
];

const counts = computed(() => ({
  paid: rows.value.filter((item) => item.status === 'PAID').length,
  preparing: rows.value.filter((item) => item.status === 'PREPARING').length,
  ready: rows.value.filter((item) => item.status === 'READY_PICKUP').length,
}));

const visible = computed(() =>
  rows.value.filter(
    (item) => filter.value === 'ALL' || item.status === filter.value,
  ),
);

function idle(amount?: string) {
  return !amount || Number(amount) === 0;
}

function usedText(amount?: string) {
  if (idle(amount)) return '未使用';
  return `已抵扣 ¥${amount}`;
}

function tone(status: string) {
  if (status === 'PAID') return 'processing';
  if (status === 'PREPARING') return 'warning';
  if (status === 'READY_PICKUP') return 'success';
  return 'default';
}

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Order[]>('/orders');
  } finally {
    loading.value = false;
  }
}

async function openDetail(order: Order | Record<string, any>) {
  const item = order as Order;
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = item;
  try {
    detail.value = await requestClient.get<Order>(`/orders/${item.id}`);
  } finally {
    detailLoading.value = false;
  }
}

async function submit() {
  const order = detail.value;
  if (!order?.action) return;
  const path = order.action === 'PREPARE' ? 'prepare' : 'ready';
  acting.value = true;
  try {
    await requestClient.post(`/orders/${order.id}/${path}`);
    message.success(order.action === 'PREPARE' ? '已开始备货' : '已生成取件码');
    detailOpen.value = false;
    await load();
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="待备货的订单先开始备货，备货完成生成取件码。顾客取货由自提点确认。"
    title="备货与自提"
  >
    <div class="board">
      <button
        class="metric sale"
        :class="{ on: filter === 'PAID' }"
        type="button"
        @click="filter = 'PAID'"
      >
        <span>待备货</span>
        <b>{{ counts.paid }}</b>
        <small>顾客已支付，等待开始备货</small>
      </button>
      <button
        class="metric warn"
        :class="{ on: filter === 'PREPARING' }"
        type="button"
        @click="filter = 'PREPARING'"
      >
        <span>备货中</span>
        <b>{{ counts.preparing }}</b>
        <small>备齐后生成取件码</small>
      </button>
      <button
        class="metric pending"
        :class="{ on: filter === 'READY_PICKUP' }"
        type="button"
        @click="filter = 'READY_PICKUP'"
      >
        <span>待自提</span>
        <b>{{ counts.ready }}</b>
        <small>取件码已交给顾客，到店后由自提点确认</small>
      </button>
      <Card class="panel">
        <div class="toolbar">
          <Radio.Group v-model:value="filter" button-style="solid">
            <Radio.Button value="ALL">全部</Radio.Button>
            <Radio.Button value="PAID">待备货</Radio.Button>
            <Radio.Button value="PREPARING">备货中</Radio.Button>
            <Radio.Button value="READY_PICKUP">待自提</Radio.Button>
            <Radio.Button value="PICKED_UP">已自提</Radio.Button>
            <Radio.Button value="COMPLETED">已完成</Radio.Button>
          </Radio.Group>
          <Button class="refresh" @click="load">刷新</Button>
        </div>
        <Table
          :columns="columns"
          :data-source="visible"
          :loading="loading"
          :pagination="false"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'goods'">
              <button class="goods" type="button" @click="openDetail(record)">
                <b>{{ record.goods }}</b>
                <small>查看商品明细</small>
              </button>
            </template>
            <template v-else-if="column.key === 'buyer'">
              <div class="buyer">
                <b>{{ record.buyer }}</b>
                <small>{{ record.mobile }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'point'">
              {{
                record.fulfillmentText === '到店自提'
                  ? record.destinationName
                  : record.fulfillmentText
              }}
            </template>
            <template v-else-if="column.key === 'amount'">
              ¥{{ record.payableAmount }}
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="tone(record.status)">{{ record.statusName }}</Tag>
            </template>
            <template v-else-if="column.key === 'code'">
              <b v-if="record.pickupCodeText" class="code">{{
                record.pickupCodeText
              }}</b>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                v-if="record.actionName"
                size="small"
                type="link"
                @click="openDetail(record)"
              >
                {{ record.actionName }}
              </Button>
            </template>
          </template>
        </Table>
      </Card>
    </div>
    <Modal
      v-model:open="detailOpen"
      :footer="null"
      :title="null"
      width="680px"
      wrap-class-name="prep-modal"
      @cancel="detailOpen = false"
    >
      <div v-if="detail" class="sheet">
        <div class="hero">
          <div>
            <span>{{ detail.actionName || '订单明细' }}</span>
            <b>{{ detail.orderNo }}</b>
            <p>{{ detail.buyer }} · {{ detail.mobile }}</p>
          </div>
          <Tag :color="tone(detail.status)">{{ detail.statusName }}</Tag>
        </div>
        <div v-if="detailLoading" class="sheet-wait">正在读取订单</div>
        <div v-else class="sheet-body">
          <section class="place">
            <i>{{ detail.fulfillmentText === '到店自提' ? '提' : '送' }}</i>
            <div>
              <span>{{ detail.fulfillmentText }}</span>
              <b>{{ detail.destinationName || '未填写' }}</b>
              <small>{{ detail.destinationAddress || '地址未记录' }}</small>
              <small v-if="detail.destinationPhone">电话 {{ detail.destinationPhone }}</small>
            </div>
            <em v-if="detail.pickupCodeText">{{ detail.pickupCodeText }}</em>
          </section>
          <section class="goods-panel">
            <header>
              <b>本次要备的商品</b>
              <span>共 {{ detail.goodsQty }} 件</span>
            </header>
            <article
              v-for="item in detail.items || []"
              :key="`${item.name}-${item.spec}`"
              class="sku"
            >
              <img v-if="item.imageUrl" :alt="item.name" :src="item.imageUrl" />
              <i v-else>{{ item.name.slice(0, 1) }}</i>
              <div class="sku-copy">
                <b>{{ item.name }}</b>
                <small>{{ item.spec }} · 单价 ¥{{ item.price }}</small>
              </div>
              <em>× {{ item.quantity }}</em>
              <strong>¥{{ item.amount }}</strong>
            </article>
          </section>
          <section class="bill">
            <p>
              <span>商品金额</span><b>¥{{ detail.goodsAmount || '0.00' }}</b>
            </p>
            <p>
              <span>折扣 / 秒杀</span>
              <b :class="{ idle: idle(detail.activityAmount) }">{{
                usedText(detail.activityAmount)
              }}</b>
            </p>
            <p>
              <span>满减</span>
              <b :class="{ idle: idle(detail.fullReductionAmount) }">{{
                usedText(detail.fullReductionAmount)
              }}</b>
            </p>
            <p>
              <span>优惠券</span>
              <b :class="{ idle: idle(detail.couponAmount) }">{{
                usedText(detail.couponAmount)
              }}</b>
            </p>
            <p>
              <span>积分</span>
              <b :class="{ idle: !detail.pointsUsed }">
                {{
                  detail.pointsUsed
                    ? `使用 ${detail.pointsUsed} 积分，抵 ¥${detail.pointAmount}`
                    : '未使用'
                }}
              </b>
            </p>
            <p v-if="detail.remark" class="note">
              <span>买家备注</span><b>{{ detail.remark }}</b>
            </p>
            <p class="pay">
              <span>实付</span><b>¥{{ detail.payableAmount }}</b>
            </p>
          </section>
        </div>
        <div class="sheet-foot">
          <p v-if="detail.action === 'READY'">
            确认后生成取件码，顾客凭码到店自提。
          </p>
          <p v-else-if="detail.action === 'PREPARE'">
            核对商品和自提点后，再开始备货。
          </p>
          <p v-else>订单明细</p>
          <div>
            <Button @click="detailOpen = false">关闭</Button>
            <Button
              v-if="detail.actionName"
              :loading="acting"
              type="primary"
              @click="submit"
            >
              {{ detail.actionName }}
            </Button>
          </div>
        </div>
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
  max-width: 18em;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}

.metric.sale.on {
  border-color: hsl(var(--primary) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 16%);
}

.metric.warn.on {
  border-color: hsl(var(--warning) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--warning) / 16%);
}

.metric.pending.on {
  border-color: hsl(var(--success) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--success) / 16%);
}

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.warn b {
  color: hsl(var(--warning));
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

.refresh {
  margin-left: auto;
}

.buyer {
  display: flex;
  flex-direction: column;
}

.buyer small,
.muted {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.goods {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  padding: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.goods b {
  font-weight: 650;
  color: hsl(var(--foreground));
}

.goods small {
  font-size: 12px;
  color: hsl(var(--primary));
}

.sheet {
  display: flex;
  flex-direction: column;
}

.hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 56px 18px 22px;
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 22%),
    hsl(var(--card)) 62%
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
  font-size: 18px;
  color: hsl(var(--foreground));
  letter-spacing: -0.02em;
}

.hero p {
  margin: 6px 0 0;
}

.sheet-wait {
  padding: 28px 22px;
  margin: 0;
  color: hsl(var(--muted-foreground));
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 22px 8px;
}

.place {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.place > i {
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  font-style: normal;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 12px;
}

.place div {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.place span {
  font-size: 12px;
  font-weight: 650;
  color: hsl(var(--primary));
}

.place b {
  font-size: 15px;
}

.place small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.place em {
  flex: none;
  font-size: 22px;
  font-style: normal;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
  letter-spacing: 0.06em;
}

.goods-panel {
  overflow: hidden;
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 10%),
    hsl(var(--card)) 48px
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.goods-panel header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px 8px;
}

.goods-panel header span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sku {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  margin: 0 10px 8px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.sku img,
.sku > i {
  flex: none;
  width: 52px;
  height: 52px;
  object-fit: cover;
  background: hsl(var(--accent));
  border-radius: 12px;
}

.sku > i {
  display: grid;
  place-items: center;
  font-style: normal;
  font-weight: 700;
  color: hsl(var(--primary));
}

.sku-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.sku-copy b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sku-copy small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sku em {
  flex: none;
  padding: 2px 8px;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-radius: 999px;
}

.sku strong {
  min-width: 4.5em;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.bill {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.bill p {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin: 0;
}

.bill span {
  color: hsl(var(--muted-foreground));
}

.bill .idle {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.bill .note b {
  max-width: 70%;
  font-weight: 500;
  text-align: right;
}

.bill .pay {
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px dashed hsl(var(--border));
}

.bill .pay b {
  font-size: 20px;
  color: hsl(var(--primary));
}

.sheet-foot {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  margin-top: 8px;
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
.prep-modal .ant-modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 18px;
}

.prep-modal .ant-modal-header {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

.prep-modal .ant-modal-title {
  display: none;
}

.prep-modal .ant-modal-body {
  padding: 0;
}

.prep-modal .ant-modal-close {
  color: hsl(var(--foreground));
}
</style>
