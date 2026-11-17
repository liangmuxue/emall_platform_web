<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  Modal,
  Radio,
  Select,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Product = {
  auditRemark?: string;
  categoryName: string;
  coverUrl?: string;
  id: number;
  productName: string;
  salesStatus: string;
  shopName: string;
  skuCount?: number;
  specSummary?: string;
  spuNo?: string;
  statusName: string;
  stock?: number;
};

type Sku = {
  key: string;
  marketPrice?: null | number;
  memberPrice?: null | number;
  parentKey?: string;
  salePrice?: null | number;
  skuName: string;
  stock?: null | number;
  unitName?: null | string;
};

type SpecRow = {
  depth: number;
  group: boolean;
  key: string;
  lead: boolean;
  marketPrice?: null | number;
  memberPrice?: null | number;
  salePrice?: null | number;
  skuName: string;
  stock?: null | number;
  unitName?: null | string;
};

const rows = ref<Product[]>([]);
const loading = ref(false);
const keyword = ref('');
const filter = ref('pending');
const expanded = ref<number[]>([]);
const specs = ref<Record<number, SpecRow[]>>({});
const specLoading = ref<Record<number, boolean>>({});
const open = ref(false);
const saving = ref(false);
const current = ref<null | Product>(null);
const form = reactive({ remark: '', result: 'ON_SALE' });
const columns: TableColumnsType = [
  { title: '商品信息', dataIndex: 'productName', key: 'product' },
  { title: '店铺', dataIndex: 'shopName', key: 'shopName', width: 150 },
  { title: '类目', dataIndex: 'categoryName', key: 'categoryName', width: 140 },
  { title: '总库存', dataIndex: 'stock', key: 'stock', width: 100 },
  { title: '状态', dataIndex: 'statusName', key: 'status', width: 160 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
];

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  OFF_SHELF: 'warning',
  ON_SALE: 'success',
  PENDING: 'processing',
  REJECTED: 'error',
};

const counts = computed(() => ({
  on: rows.value.filter((item) => item.salesStatus === 'ON_SALE').length,
  pending: rows.value.filter((item) => item.salesStatus === 'PENDING').length,
  rejected: rows.value.filter((item) => item.salesStatus === 'REJECTED').length,
}));

const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter((item) => {
    const text = [item.productName, item.shopName, item.categoryName, item.spuNo, item.specSummary]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (query && !text.includes(query)) return false;
    if (filter.value === 'pending') return item.salesStatus === 'PENDING';
    if (filter.value === 'on') return item.salesStatus === 'ON_SALE';
    if (filter.value === 'rejected') return item.salesStatus === 'REJECTED';
    if (filter.value === 'off') return item.salesStatus === 'OFF_SHELF';
    if (filter.value === 'draft') return item.salesStatus === 'DRAFT';
    return true;
  });
});

function money(value?: null | number) {
  return value == null ? '—' : `¥${Number(value).toFixed(2)}`;
}

function specRows(list: Sku[]) {
  const childrenOf = (parent: string) => list.filter((item) => (item.parentKey || '') === parent);
  const built: SpecRow[] = [];
  const walk = (parent: string, depth: number) => {
    childrenOf(parent).forEach((item) => {
      const group = childrenOf(item.key).length > 0;
      built.push({
        depth,
        group,
        key: item.key,
        lead: false,
        marketPrice: item.marketPrice,
        memberPrice: item.memberPrice,
        salePrice: item.salePrice,
        skuName: item.skuName,
        stock: item.stock,
        unitName: item.unitName,
      });
      walk(item.key, depth + 1);
    });
  };
  walk('', 0);
  const prices = built
    .filter((item) => !item.group && Number(item.salePrice) > 0)
    .map((item) => Number(item.salePrice));
  const lowest = prices.length ? Math.min(...prices) : Number.NaN;
  const lead = built.find((item) => !item.group && Number(item.salePrice) === lowest);
  if (lead && prices.length > 1) lead.lead = true;
  return built;
}

function isOpen(id: number) {
  return expanded.value.includes(id);
}

async function loadSpecs(id: number) {
  if (specs.value[id] || specLoading.value[id]) return;
  specLoading.value = { ...specLoading.value, [id]: true };
  try {
    const product = await requestClient.get<{ skus?: Sku[] }>(`/products/${id}`);
    specs.value = { ...specs.value, [id]: specRows(product.skus || []) };
  } finally {
    specLoading.value = { ...specLoading.value, [id]: false };
  }
}

function toggle(record: Product) {
  if (isOpen(record.id)) {
    expanded.value = expanded.value.filter((id) => id !== record.id);
    return;
  }
  expanded.value = [...expanded.value, record.id];
  void loadSpecs(record.id);
}

function statusTone(item: Product) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0) return 'default';
  return statusColor[item.salesStatus] || 'default';
}

function statusText(item: Product) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0) return '已售罄';
  return item.statusName;
}

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Product[]>('/products', { params: { status: 'ALL' } });
  } finally {
    loading.value = false;
  }
}

function openAudit(record: Product) {
  current.value = record;
  form.result = record.salesStatus === 'ON_SALE' ? 'OFF_SHELF' : 'ON_SALE';
  form.remark = '';
  open.value = true;
}

async function submit() {
  if (!current.value) return;
  if ((form.result === 'REJECTED' || form.result === 'OFF_SHELF') && !form.remark.trim()) {
    message.warning('驳回或下架时请填写原因');
    return;
  }
  saving.value = true;
  try {
    await requestClient.post(`/products/${current.value.id}/audit`, {
      remark: form.remark.trim(),
      result: form.result,
    });
    message.success('已处理');
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page description="价格写在规格里。点开商品即可核对每个规格的售价、划线价和会员价。" title="商品审核">
    <div class="board">
      <button class="metric pending" :class="{ on: filter === 'pending' }" type="button" @click="filter = 'pending'">
        <span>待审核</span>
        <b>{{ counts.pending }}</b>
        <small>商家已提交，等待处理</small>
      </button>
      <button class="metric sale" :class="{ on: filter === 'on' }" type="button" @click="filter = 'on'">
        <span>已上架</span>
        <b>{{ counts.on }}</b>
        <small>通过后顾客可以在分类里看到</small>
      </button>
      <button class="metric warn" :class="{ on: filter === 'rejected' }" type="button" @click="filter = 'rejected'">
        <span>已驳回</span>
        <b>{{ counts.rejected }}</b>
        <small>商家修改后可以再次提交</small>
      </button>
      <Card class="panel">
        <div class="toolbar">
          <Input
            v-model:value="keyword"
            allow-clear
            class="search"
            placeholder="搜索商品、店铺、类目或货号"
          />
          <Radio.Group v-model:value="filter" button-style="solid">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="pending">待审核</Radio.Button>
            <Radio.Button value="on">已上架</Radio.Button>
            <Radio.Button value="rejected">已驳回</Radio.Button>
            <Radio.Button value="off">已下架</Radio.Button>
            <Radio.Button value="draft">草稿</Radio.Button>
          </Radio.Group>
          <Button class="refresh" @click="load">刷新</Button>
        </div>
        <Table
          class="list"
          :columns="columns"
          :data-source="filtered"
          :expanded-row-keys="expanded"
          :loading="loading"
          :pagination="{ pageSize: 10, showTotal: (total: number) => `共 ${total} 个商品` }"
          :scroll="{ x: 980 }"
          :show-expand-column="false"
          row-key="id"
        >
          <template #expandedRowRender="{ record }">
            <div class="drawer">
              <div class="drawer-head">
                <b>规格价格</b>
                <span>分组规格不单独标价</span>
              </div>
              <p v-if="specLoading[record.id]" class="drawer-wait">正在读取规格…</p>
              <p v-else-if="!specs[record.id]" class="drawer-wait">规格没有读取到</p>
              <p v-else-if="!specs[record.id].length" class="drawer-wait">还没有规格</p>
              <div v-else class="spec-list">
                <template v-for="row in specs[record.id]" :key="row.key">
                  <div v-if="row.group" class="group-line" :style="{ marginLeft: `${row.depth * 22}px` }">
                    <i></i>
                    <b>{{ row.skuName }}</b>
                    <em>分组</em>
                    <span>价格由下级填写</span>
                  </div>
                  <article
                    v-else
                    class="leaf"
                    :class="{ lead: row.lead }"
                    :style="{ marginLeft: `${row.depth * 22}px` }"
                  >
                    <div class="leaf-name">
                      <i :class="row.depth ? 'branch' : 'root'"></i>
                      <b>{{ row.skuName }}</b>
                      <em>{{ row.unitName || '份' }}</em>
                      <span v-if="row.lead" class="badge">最低</span>
                    </div>
                    <dl class="figures">
                      <div>
                        <dt>售价</dt>
                        <dd>{{ money(row.salePrice) }}</dd>
                      </div>
                      <div>
                        <dt>划线价</dt>
                        <dd :class="{ strike: row.marketPrice }">{{ money(row.marketPrice) }}</dd>
                      </div>
                      <div>
                        <dt>会员价</dt>
                        <dd class="member">{{ money(row.memberPrice) }}</dd>
                      </div>
                      <div>
                        <dt>库存</dt>
                        <dd>{{ row.stock == null ? '—' : row.stock }}</dd>
                      </div>
                    </dl>
                  </article>
                </template>
              </div>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'product'">
              <div class="product">
                <div class="cover">
                  <img v-if="record.coverUrl" :src="record.coverUrl" alt="" />
                  <span v-else>{{ record.productName.slice(0, 1) }}</span>
                </div>
                <div class="copy">
                  <b>{{ record.productName }}</b>
                  <small>{{ record.spuNo || '未填货号' }} · {{ record.skuCount || 0 }} 个规格</small>
                  <button class="peek" :class="{ open: isOpen(record.id) }" type="button" @click="toggle(record)">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                    {{ isOpen(record.id) ? '收起规格价格' : '查看规格价格' }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'stock'">
              <span class="stock">{{ record.stock ?? 0 }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <div class="status">
                <Tag :color="statusTone(record)">{{ statusText(record) }}</Tag>
                <small v-if="record.auditRemark">{{ record.auditRemark }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                v-if="record.salesStatus === 'PENDING' || record.salesStatus === 'ON_SALE'"
                size="small"
                type="link"
                @click="openAudit(record)"
              >
                {{ record.salesStatus === 'ON_SALE' ? '下架' : '审核' }}
              </Button>
            </template>
          </template>
        </Table>
      </Card>
    </div>
    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      :title="current?.salesStatus === 'ON_SALE' ? '下架商品' : '审核商品'"
      @ok="submit"
    >
      <Form layout="vertical">
        <FormItem v-if="current?.salesStatus === 'PENDING'" label="结果">
          <Select
            v-model:value="form.result"
            :options="[
              { label: '通过并上架', value: 'ON_SALE' },
              { label: '驳回', value: 'REJECTED' },
            ]"
          />
        </FormItem>
        <FormItem label="原因">
          <Input.TextArea v-model:value="form.remark" :rows="3" placeholder="驳回或下架时必填" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.panel { grid-column: 1 / -1; overflow: hidden; border-radius: 14px; }
.metric { position: relative; display: flex; min-height: 112px; flex-direction: column; align-items: flex-start; gap: 6px; overflow: hidden; padding: 18px 20px; border: 1px solid hsl(var(--border)); border-radius: 14px; background: hsl(var(--card)); text-align: left; cursor: pointer; isolation: isolate; }
.metric::before, .metric::after { content: ""; position: absolute; pointer-events: none; }
.metric::before { inset: 0; z-index: -1; }
.metric::after { top: -36px; right: -28px; z-index: -1; width: 120px; height: 120px; border-radius: 50%; }
.metric.sale::before { background: linear-gradient(145deg, hsl(var(--primary) / 28%), hsl(var(--card)) 58%); }
.metric.sale::after { background: radial-gradient(circle, hsl(var(--primary) / 42%), transparent 68%); }
.metric.warn::before { background: linear-gradient(145deg, hsl(var(--warning) / 26%), hsl(var(--card)) 58%); }
.metric.warn::after { background: radial-gradient(circle, hsl(var(--warning) / 40%), transparent 68%); }
.metric.pending::before { background: linear-gradient(145deg, hsl(var(--success) / 24%), hsl(var(--card)) 58%); }
.metric.pending::after { background: radial-gradient(circle, hsl(var(--success) / 38%), transparent 68%); }
.metric b { font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
.metric span { color: hsl(var(--foreground)); font-size: 13px; font-weight: 650; }
.metric small { max-width: 18em; color: hsl(var(--muted-foreground)); font-size: 12px; line-height: 1.45; }
.metric.sale b { color: hsl(var(--primary)); }
.metric.sale.on { border-color: hsl(var(--primary) / 70%); box-shadow: 0 0 0 3px hsl(var(--primary) / 16%); }
.metric.warn b { color: hsl(var(--warning)); }
.metric.warn.on { border-color: hsl(var(--warning) / 70%); box-shadow: 0 0 0 3px hsl(var(--warning) / 16%); }
.metric.pending b { color: hsl(var(--success)); }
.metric.pending.on { border-color: hsl(var(--success) / 65%); box-shadow: 0 0 0 3px hsl(var(--success) / 16%); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 4px; padding: 4px 4px 14px; border-bottom: 1px solid hsl(var(--border)); }
.search { width: 280px; }
.refresh { margin-left: auto; }
.product { display: flex; align-items: center; gap: 12px; min-width: 240px; }
.cover { display: grid; width: 56px; height: 56px; flex: none; place-items: center; overflow: hidden; border: 1px solid hsl(var(--border)); border-radius: 12px; background: hsl(var(--accent)); color: hsl(var(--muted-foreground)); font-weight: 700; }
.cover img { width: 100%; height: 100%; object-fit: cover; }
.copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.copy b { overflow: hidden; color: hsl(var(--foreground)); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.copy small { overflow: hidden; color: hsl(var(--muted-foreground)); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.peek { display: inline-flex; align-items: center; gap: 4px; width: fit-content; padding: 0; border: 0; background: transparent; color: hsl(var(--primary)); font-size: 12px; cursor: pointer; }
.peek svg { width: 12px; height: 12px; fill: none; stroke: currentcolor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform .15s ease; }
.peek.open svg { transform: rotate(90deg); }
.stock { font-variant-numeric: tabular-nums; font-weight: 650; }
.status { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.status small { color: hsl(var(--muted-foreground)); font-size: 12px; line-height: 1.4; }
.list :deep(.ant-table-cell) { vertical-align: middle; }
.list :deep(.ant-table) { background: transparent; }
.list :deep(.ant-table-thead > tr > th) { font-weight: 650; }
.list :deep(.ant-table-expanded-row > .ant-table-cell) { padding: 2px 16px 16px !important; background: transparent !important; }
.drawer { overflow: hidden; border: 1px solid hsl(var(--border)); border-radius: 14px; background: linear-gradient(180deg, hsl(var(--primary) / 12%), hsl(var(--card)) 64px); }
.drawer-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 16px 8px; }
.drawer-head b { font-size: 13px; }
.drawer-head span, .drawer-wait { color: hsl(var(--muted-foreground)); font-size: 12px; }
.drawer-wait { margin: 0; padding: 8px 16px 16px; }
.spec-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 12px 12px; }
.group-line { display: flex; align-items: center; gap: 8px; padding: 6px 4px 0; color: hsl(var(--muted-foreground)); font-size: 13px; }
.group-line i { width: 8px; height: 8px; flex: none; border-radius: 8px; background: hsl(var(--primary)); }
.group-line b { color: hsl(var(--foreground)); font-weight: 650; }
.group-line em { padding: 0 7px; border-radius: 999px; background: hsl(var(--accent)); font-style: normal; font-size: 12px; line-height: 20px; }
.leaf { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border: 1px solid hsl(var(--border)); border-radius: 12px; background: hsl(var(--card)); }
.leaf.lead { border-color: hsl(var(--primary) / 50%); background: linear-gradient(90deg, hsl(var(--primary) / 14%), hsl(var(--card)) 46%); }
.leaf-name { display: flex; min-width: 0; align-items: center; gap: 8px; }
.leaf-name b { overflow: hidden; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.leaf-name em { color: hsl(var(--muted-foreground)); font-style: normal; font-size: 12px; }
.leaf-name .root, .leaf-name .branch { width: 8px; height: 8px; flex: none; border-radius: 8px; background: hsl(var(--primary)); }
.leaf-name .branch { background: transparent; box-shadow: inset 0 0 0 2px hsl(var(--primary)); }
.badge { padding: 0 7px; border-radius: 999px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: 12px; font-weight: 600; line-height: 20px; }
.figures { display: grid; grid-template-columns: repeat(4, 84px); gap: 10px; margin: 0; }
.figures div { display: flex; flex-direction: column; gap: 2px; }
.figures dt { color: hsl(var(--muted-foreground)); font-size: 12px; font-weight: 500; }
.figures dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
.figures .strike { color: hsl(var(--muted-foreground)); font-weight: 500; text-decoration: line-through; }
.figures .member { color: hsl(var(--primary)); }
</style>
