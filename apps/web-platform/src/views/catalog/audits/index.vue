<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Image,
  Input,
  message,
  Modal,
  Radio,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Product = {
  auditRemark?: string;
  categoryName: string;
  coverUrl?: string;
  id: number;
  createdAt?: string;
  marketPrice?: null | number;
  memberPrice?: null | number;
  price?: null | number;
  priceFrom?: boolean;
  productName: string;
  salesStatus: string;
  shopName: string;
  skuCount?: number;
  specSummary?: string;
  spuNo?: string;
  statusName: string;
  stock?: number;
};

type ProductDetail = Product & {
  detail?: string;
  fakeSold?: number;
  imageUrls?: string[];
  services?: string;
  skus?: Sku[];
  soldCount?: number;
  specImages?: boolean;
};

type Sku = {
  imageUrl?: null | string;
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
  imageUrl?: null | string;
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
const detailLoading = ref(false);
const current = ref<null | Product>(null);
const detail = ref<null | ProductDetail>(null);
const form = reactive({ remark: '', result: 'ON_SALE' });
const columns: TableColumnsType = [
  { title: '商品信息', dataIndex: 'productName', key: 'product' },
  { title: '店铺', dataIndex: 'shopName', key: 'shopName', width: 150 },
  { title: '类目', dataIndex: 'categoryName', key: 'categoryName', width: 140 },
  { title: '售价', key: 'price', width: 110 },
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
    const text = [
      item.productName,
      item.shopName,
      item.categoryName,
      item.spuNo,
      item.specSummary,
    ]
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
  if (value === undefined || value === null) return '—';
  return `¥${Number(value).toFixed(2)}`;
}

function specRows(list: Sku[]) {
  const childrenOf = (parent: string) =>
    list.filter((item) => (item.parentKey || '') === parent);
  const built: SpecRow[] = [];
  const walk = (parent: string, depth: number) => {
    childrenOf(parent).forEach((item) => {
      const group = childrenOf(item.key).length > 0;
      built.push({
        depth,
        group,
        imageUrl: item.imageUrl,
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
  const lowest = prices.length > 0 ? Math.min(...prices) : Number.NaN;
  const lead = built.find(
    (item) => !item.group && Number(item.salePrice) === lowest,
  );
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
    const product = await requestClient.get<{ skus?: Sku[] }>(
      `/products/${id}`,
    );
    specs.value = { ...specs.value, [id]: specRows(product.skus || []) };
  } finally {
    specLoading.value = { ...specLoading.value, [id]: false };
  }
}

function toggle(record: Product | Record<string, any>) {
  if (isOpen(record.id)) {
    expanded.value = expanded.value.filter((id) => id !== record.id);
    return;
  }
  expanded.value = [...expanded.value, record.id];
  void loadSpecs(record.id);
}

function statusTone(item: Product | Record<string, any>) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0)
    return 'default';
  return statusColor[item.salesStatus] || 'default';
}

function statusText(item: Product | Record<string, any>) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0)
    return '已售罄';
  return item.statusName;
}

function toneClass(item: Product | Record<string, any>) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0)
    return 'tone tone-off';
  if (item.salesStatus === 'PENDING') return 'tone tone-pending';
  if (item.salesStatus === 'ON_SALE') return 'tone tone-on';
  if (item.salesStatus === 'REJECTED') return 'tone tone-bad';
  if (item.salesStatus === 'OFF_SHELF') return 'tone tone-off';
  return 'tone';
}

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Product[]>('/products', {
      params: { status: 'ALL' },
    });
  } finally {
    loading.value = false;
  }
}

const sheetSpecs = computed(() => specRows(detail.value?.skus || []));
const sheetImages = computed(
  () => detail.value?.imageUrls?.filter(Boolean) || [],
);
const coverUrl = computed(
  () => sheetImages.value[0] || current.value?.coverUrl || '',
);

function openAudit(record: Product | Record<string, any>) {
  const item = record as Product;
  current.value = item;
  detail.value = null;
  form.result = item.salesStatus === 'ON_SALE' ? 'OFF_SHELF' : 'ON_SALE';
  form.remark = '';
  open.value = true;
  detailLoading.value = true;
  requestClient
    .get<ProductDetail>(`/products/${item.id}`)
    .then((product) => {
      detail.value = product;
    })
    .finally(() => {
      detailLoading.value = false;
    });
}

async function submit() {
  if (!current.value) return;
  if (
    (form.result === 'REJECTED' || form.result === 'OFF_SHELF') &&
    !form.remark.trim()
  ) {
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
  <Page
    description="点审核可核对图片、规格价格、图文详情和服务承诺，再决定通过、驳回或下架。"
    title="商品审核"
  >
    <div class="board">
      <button
        class="metric pending"
        :class="{ on: filter === 'pending' }"
        type="button"
        @click="filter = 'pending'"
      >
        <span>待审核</span>
        <b>{{ counts.pending }}</b>
        <small>商家已提交，等待处理</small>
      </button>
      <button
        class="metric sale"
        :class="{ on: filter === 'on' }"
        type="button"
        @click="filter = 'on'"
      >
        <span>已上架</span>
        <b>{{ counts.on }}</b>
        <small>通过后顾客可以在分类里看到</small>
      </button>
      <button
        class="metric warn"
        :class="{ on: filter === 'rejected' }"
        type="button"
        @click="filter = 'rejected'"
      >
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
          :pagination="{
            pageSize: 10,
            showTotal: (total: number) => `共 ${total} 个商品`,
          }"
          :scroll="{ x: 1120 }"
          :show-expand-column="false"
          row-key="id"
        >
          <template #expandedRowRender="{ record }">
            <div class="drawer">
              <div class="drawer-head">
                <b>规格价格</b>
                <span>分组规格不单独标价</span>
              </div>
              <p v-if="specLoading[record.id]" class="drawer-wait">
                正在读取规格…
              </p>
              <p v-else-if="!specs[record.id]" class="drawer-wait">
                规格没有读取到
              </p>
              <p v-else-if="!specs[record.id]?.length" class="drawer-wait">
                还没有规格
              </p>
              <div v-else class="spec-list">
                <template v-for="row in specs[record.id]" :key="row.key">
                  <div
                    v-if="row.group"
                    class="group-line"
                    :style="{ marginLeft: `${row.depth * 22}px` }"
                  >
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
                        <dd :class="{ strike: row.marketPrice }">
                          {{ money(row.marketPrice) }}
                        </dd>
                      </div>
                      <div>
                        <dt>会员价</dt>
                        <dd class="member">{{ money(row.memberPrice) }}</dd>
                      </div>
                      <div>
                        <dt>库存</dt>
                        <dd>
                          {{
                            row.stock === undefined || row.stock === null
                              ? '—'
                              : row.stock
                          }}
                        </dd>
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
                  <small>{{ record.spuNo || '未填货号' }} ·
                    {{ record.skuCount || 0 }} 个规格</small>
                  <small v-if="record.specSummary" class="specs">{{
                    record.specSummary
                  }}</small>
                  <button
                    class="peek"
                    :class="{ open: isOpen(record.id) }"
                    type="button"
                    @click="toggle(record)"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                    {{ isOpen(record.id) ? '收起规格价格' : '查看规格价格' }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'price'">
              <span class="stock">{{
                record.price === undefined || record.price === null
                  ? '—'
                  : `${record.priceFrom ? '起 ' : ''}${money(record.price)}`
              }}</span>
            </template>
            <template v-else-if="column.key === 'stock'">
              <span class="stock">{{ record.stock ?? 0 }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <div class="status">
                <Tag :color="statusTone(record)">{{ statusText(record) }}</Tag>
                <small v-if="record.auditRemark">{{
                  record.auditRemark
                }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                v-if="
                  record.salesStatus === 'PENDING' ||
                  record.salesStatus === 'ON_SALE'
                "
                size="small"
                type="link"
                @click="openAudit(record)"
              >
                {{ record.salesStatus === 'ON_SALE' ? '下架' : '审核' }}
              </Button>
              <Button
                v-else
                size="small"
                type="link"
                @click="openAudit(record)"
              >
                查看
              </Button>
            </template>
          </template>
        </Table>
      </Card>
    </div>
    <Modal
      :footer="null"
      :open="open"
      :title="null"
      width="860px"
      wrap-class-name="product-audit-modal"
      @cancel="open = false"
    >
      <div v-if="current" class="sheet">
        <header class="hero">
          <img v-if="coverUrl" class="hero-cover" :src="coverUrl" alt="" />
          <span v-else class="hero-cover cover-fallback">{{
            (detail?.productName || current.productName).slice(0, 1)
          }}</span>
          <div class="hero-copy">
            <div class="hero-title">
              <b>{{ detail?.productName || current.productName }}</b>
              <em :class="toneClass(detail || current)">{{
                statusText(detail || current)
              }}</em>
            </div>
            <div class="meta">
              <span>{{ current.shopName }}</span>
              <span>{{ current.categoryName }}</span>
              <span>{{ current.spuNo || '未填货号' }}</span>
              <span>{{
                (current.createdAt || '').slice(0, 16) || '提交时间未记录'
              }}</span>
            </div>
          </div>
        </header>
        <div class="stat-row">
          <div class="hot">
            <b>{{
              current.price === undefined || current.price === null
                ? '—'
                : `${current.priceFrom ? '起 ' : ''}${money(current.price)}`
            }}</b>
            <span>最低售价</span>
          </div>
          <div>
            <b>{{ money(current.marketPrice) }}</b>
            <span>划线价</span>
          </div>
          <div>
            <b>{{ money(current.memberPrice) }}</b>
            <span>会员价</span>
          </div>
          <div>
            <b>{{ current.stock ?? 0 }}</b>
            <span>总库存</span>
          </div>
          <div>
            <b>{{ detail?.soldCount ?? 0 }}</b>
            <span>真实已售</span>
          </div>
          <div>
            <b>{{ detail?.fakeSold ?? 0 }}</b>
            <span>基础已售</span>
          </div>
        </div>
        <div class="sheet-spin">
          <Spin :spinning="detailLoading">
            <div class="sheet-body">
              <section v-if="sheetImages.length > 1" class="panel-block">
                <h3>商品图片</h3>
                <Image.PreviewGroup>
                  <div class="gallery">
                    <Image v-for="url in sheetImages" :key="url" :src="url" />
                  </div>
                </Image.PreviewGroup>
              </section>
              <section class="panel-block">
                <h3>规格价格</h3>
                <p v-if="!sheetSpecs.length" class="empty">还没有规格</p>
                <div v-else class="spec-card">
                  <table class="spec-table">
                    <thead>
                      <tr>
                        <th>规格</th>
                        <th>单位</th>
                        <th>售价</th>
                        <th>划线价</th>
                        <th>会员价</th>
                        <th>库存</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in sheetSpecs"
                        :key="row.key"
                        :class="{ group: row.group, lead: row.lead }"
                      >
                        <td v-if="row.group" class="spec-name" colspan="6">
                          {{ row.skuName }}
                        </td>
                        <template v-else>
                          <td
                            class="spec-name"
                            :style="{
                              paddingLeft: `${14 + row.depth * 16}px`,
                            }"
                          >
                            <img
                              v-if="row.imageUrl"
                              :src="row.imageUrl"
                              alt=""
                            />
                            <span>{{ row.skuName }}</span>
                            <i v-if="row.lead">最低</i>
                          </td>
                          <td>{{ row.unitName || '份' }}</td>
                          <td class="price">{{ money(row.salePrice) }}</td>
                          <td :class="{ muted: row.marketPrice }">
                            {{ money(row.marketPrice) }}
                          </td>
                          <td>{{ money(row.memberPrice) }}</td>
                          <td>
                            {{
                              row.stock === undefined || row.stock === null
                                ? '—'
                                : row.stock
                            }}
                          </td>
                        </template>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section class="panel-block">
                <h3>图文详情</h3>
                <div
                  v-if="detail?.detail"
                  class="prose"
                  v-html="detail.detail"
                ></div>
                <p v-else class="empty">没有填写商品介绍</p>
              </section>
              <section class="panel-block">
                <h3>服务承诺</h3>
                <div
                  v-if="detail?.services"
                  class="services"
                  v-html="detail.services"
                ></div>
                <p v-else class="empty">没有填写服务承诺</p>
              </section>
              <section
                v-if="detail?.auditRemark || current.auditRemark"
                class="panel-block"
              >
                <h3>上次审核说明</h3>
                <p class="note">
                  {{ detail?.auditRemark || current.auditRemark }}
                </p>
              </section>
            </div>
          </Spin>
        </div>
        <footer
          class="sheet-foot"
          :class="{
            quiet:
              current.salesStatus !== 'PENDING' &&
              current.salesStatus !== 'ON_SALE',
          }"
        >
          <template v-if="current.salesStatus === 'PENDING'">
            <div class="choices">
              <button
                class="choice pass"
                :class="{ on: form.result === 'ON_SALE' }"
                type="button"
                @click="form.result = 'ON_SALE'"
              >
                <b>通过并上架</b>
                <span>顾客可以在分类里看到</span>
                <i></i>
              </button>
              <button
                class="choice reject"
                :class="{ on: form.result === 'REJECTED' }"
                type="button"
                @click="form.result = 'REJECTED'"
              >
                <b>驳回</b>
                <span>商家修改后可以再提交</span>
                <i></i>
              </button>
            </div>
            <label class="remark">
              <span>{{
                form.result === 'REJECTED' ? '驳回原因' : '给商家的说明'
              }}</span>
              <Input.TextArea
                v-model:value="form.remark"
                :maxlength="200"
                :rows="2"
                :placeholder="
                  form.result === 'REJECTED'
                    ? '请写明驳回原因，商家会看到这段说明。'
                    : '可以留空，也可以写一句给商家看的话。'
                "
              />
            </label>
          </template>
          <template v-else-if="current.salesStatus === 'ON_SALE'">
            <div class="off-banner">
              <b>下架这件商品</b>
              <span>下架后顾客不能再购买，原因会展示给商家。</span>
            </div>
            <label class="remark">
              <span>下架原因</span>
              <Input.TextArea
                v-model:value="form.remark"
                :maxlength="200"
                :rows="2"
                placeholder="请写明下架原因，商家会看到这段说明。"
              />
            </label>
          </template>
          <p v-else class="foot-note">这里只核对商品内容，状态不会改变。</p>
          <div class="foot-bar">
            <p v-if="current.salesStatus === 'PENDING'">
              {{
                form.result === 'REJECTED'
                  ? '驳回时原因必填。'
                  : '通过后商品会立即上架。'
              }}
            </p>
            <p v-else-if="current.salesStatus === 'ON_SALE'">
              下架时原因必填。
            </p>
            <div class="foot-actions">
              <Button @click="open = false">
                {{
                  current.salesStatus === 'PENDING' ||
                  current.salesStatus === 'ON_SALE'
                    ? '取消'
                    : '关闭'
                }}
              </Button>
              <Button
                v-if="
                  current.salesStatus === 'PENDING' ||
                  current.salesStatus === 'ON_SALE'
                "
                :danger="form.result !== 'ON_SALE'"
                :loading="saving"
                type="primary"
                @click="submit"
              >
                {{
                  current.salesStatus === 'ON_SALE'
                    ? '确认下架'
                    : form.result === 'REJECTED'
                      ? '确认驳回'
                      : '确认通过'
                }}
              </Button>
            </div>
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

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.sale.on {
  border-color: hsl(var(--primary) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 16%);
}

.metric.warn b {
  color: hsl(var(--warning));
}

.metric.warn.on {
  border-color: hsl(var(--warning) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--warning) / 16%);
}

.metric.pending b {
  color: hsl(var(--success));
}

.metric.pending.on {
  border-color: hsl(var(--success) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--success) / 16%);
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

.product {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 240px;
}

.cover {
  display: grid;
  flex: none;
  place-items: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.copy .specs {
  max-width: 280px;
}

.peek {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  width: fit-content;
  padding: 0;
  font-size: 12px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: 0;
}

.peek svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.peek.open svg {
  transform: rotate(90deg);
}

.stock {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.status small {
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.list :deep(.ant-table-cell) {
  vertical-align: middle;
}

.list :deep(.ant-table) {
  background: transparent;
}

.list :deep(.ant-table-thead > tr > th) {
  font-weight: 650;
}

.list :deep(.ant-table-expanded-row > .ant-table-cell) {
  padding: 2px 16px 16px !important;
  background: transparent !important;
}

.drawer {
  overflow: hidden;
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 12%),
    hsl(var(--card)) 64px
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.drawer-head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 16px 8px;
}

.drawer-head b {
  font-size: 13px;
}

.drawer-head span,
.drawer-wait {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.drawer-wait {
  padding: 8px 16px 16px;
  margin: 0;
}

.spec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 12px 12px;
}

.group-line {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 4px 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.group-line i {
  flex: none;
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 8px;
}

.group-line b {
  font-weight: 650;
  color: hsl(var(--foreground));
}

.group-line em {
  padding: 0 7px;
  font-size: 12px;
  font-style: normal;
  line-height: 20px;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.leaf {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.leaf.lead {
  background: linear-gradient(
    90deg,
    hsl(var(--primary) / 14%),
    hsl(var(--card)) 46%
  );
  border-color: hsl(var(--primary) / 50%);
}

.leaf-name {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.leaf-name b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 650;
  white-space: nowrap;
}

.leaf-name em {
  font-size: 12px;
  font-style: normal;
  color: hsl(var(--muted-foreground));
}

.leaf-name .root,
.leaf-name .branch {
  flex: none;
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 8px;
}

.leaf-name .branch {
  background: transparent;
  box-shadow: inset 0 0 0 2px hsl(var(--primary));
}

.badge {
  padding: 0 7px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 999px;
}

.figures {
  display: grid;
  grid-template-columns: repeat(4, 84px);
  gap: 10px;
  margin: 0;
}

.figures div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.figures dt {
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.figures dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.figures .strike {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-decoration: line-through;
}

.figures .member {
  color: hsl(var(--primary));
}

.sheet {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
  background:
    radial-gradient(
      520px 180px at 0% 0%,
      hsl(var(--primary) / 16%),
      transparent 70%
    ),
    hsl(var(--card));
}

.hero,
.stat-row,
.sheet-foot {
  flex: none;
}

.hero {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 22px 56px 8px 22px;
}

.hero-cover {
  flex: none;
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 18px;
  box-shadow: 0 10px 24px hsl(0deg 0% 0% / 22%);
}

.cover-fallback {
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 650;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 14%);
}

.hero-copy {
  min-width: 0;
}

.hero-title {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.hero b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 20px;
  font-weight: 680;
  line-height: 1.3;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.tone {
  flex: none;
  padding: 2px 9px;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  line-height: 20px;
  border-radius: 999px;
}

.tone-pending {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 16%);
}

.tone-on {
  color: hsl(144deg 57% 58%);
  background: hsl(144deg 57% 58% / 16%);
}

.tone-off {
  color: hsl(42deg 84% 61%);
  background: hsl(42deg 84% 61% / 16%);
}

.tone-bad {
  color: hsl(348deg 100% 68%);
  background: hsl(348deg 100% 61% / 16%);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.meta span {
  padding: 2px 8px;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--foreground) / 6%);
  border-radius: 999px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin: 16px 22px 0;
  overflow: hidden;
  background: hsl(var(--foreground) / 4%);
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.stat-row div {
  min-width: 0;
  padding: 12px 14px 11px;
}

.stat-row div + div {
  border-left: 1px solid hsl(var(--border));
}

.stat-row b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stat-row span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.stat-row .hot b {
  color: hsl(var(--primary));
}

.sheet-spin {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.sheet-spin :deep(.ant-spin-nested-loading),
.sheet-spin :deep(.ant-spin-container) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.sheet-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 18px 22px 20px;
  overflow: auto;
}

.sheet-body > * {
  flex: none;
}

.panel-block h3 {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 650;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.08em;
}

.panel-block h3::before {
  width: 3px;
  height: 12px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.gallery :deep(.ant-image) {
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 8px 18px hsl(0deg 0% 0% / 16%);
}

.gallery :deep(.ant-image-img) {
  width: 92px;
  height: 92px;
  object-fit: cover;
}

.spec-card {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.spec-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.spec-table th {
  padding: 11px 14px;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-align: right;
  background: hsl(var(--foreground) / 4%);
}

.spec-table th:first-child {
  text-align: left;
}

.spec-table td {
  padding: 12px 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  border-top: 1px solid hsl(var(--border));
}

.spec-table td:nth-child(2) {
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.spec-table .spec-name {
  text-align: left;
}

.spec-table tr.group td {
  padding-top: 10px;
  padding-bottom: 10px;
  font-weight: 650;
  color: hsl(var(--foreground));
  text-align: left;
  background: hsl(var(--primary) / 10%);
  border-top: 0;
}

.spec-table tr.group + tr td {
  border-top: 0;
}

.spec-table tbody tr:not(.group):hover td {
  background: hsl(var(--foreground) / 4%);
}

.spec-name img {
  width: 28px;
  height: 28px;
  margin-right: 8px;
  vertical-align: middle;
  object-fit: cover;
  border-radius: 8px;
}

.spec-name span {
  vertical-align: middle;
}

.spec-name i {
  padding: 0 7px;
  margin-left: 8px;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  line-height: 18px;
  vertical-align: middle;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 999px;
}

.spec-table .price {
  font-weight: 700;
}

.spec-table tr.lead .price {
  color: hsl(var(--primary));
}

.spec-table .muted {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-decoration: line-through;
}

.empty {
  padding: 18px;
  margin: 0;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--foreground) / 4%);
  border-radius: 14px;
}

.note {
  padding: 12px 14px;
  margin: 0;
  line-height: 1.7;
  background: hsl(42deg 84% 61% / 12%);
  border-radius: 14px;
}

.prose {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 20px;
  align-items: center;
  padding: 14px 16px;
  line-height: 1.75;
  color: hsl(var(--foreground));
  background: hsl(var(--foreground) / 4%);
  border-radius: 16px;
}

.prose :deep(p) {
  flex: 1 1 220px;
  margin: 0;
}

.prose :deep(img) {
  display: block;
  flex: none;
  width: auto;
  max-width: min(100%, 280px);
  height: auto;
  max-height: 180px;
  object-fit: contain;
  background: hsl(var(--card));
  border-radius: 14px;
  box-shadow: 0 12px 28px hsl(0deg 0% 0% / 22%);
}

.services :deep(p),
.services :deep(li) {
  display: inline-flex;
  padding: 7px 12px;
  margin: 0 8px 8px 0;
  line-height: 1.4;
  background: hsl(var(--foreground) / 6%);
  border-radius: 999px;
}

.sheet-foot {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 22px 18px;
  background: hsl(var(--foreground) / 3%);
  border-top: 1px solid hsl(var(--border));
}

.sheet-foot.quiet {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.choice {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  padding: 13px 40px 13px 14px;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.choice b {
  font-size: 14px;
  font-weight: 680;
}

.choice span {
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.choice i {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 16px;
  height: 16px;
  border: 1.5px solid hsl(var(--border));
  border-radius: 50%;
}

.choice.pass.on {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
  border-color: hsl(var(--success) / 70%);
}

.choice.reject.on {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 12%);
  border-color: hsl(var(--destructive) / 70%);
}

.choice.on i {
  background: currentcolor;
  border-color: transparent;
  box-shadow: inset 0 0 0 3px hsl(var(--card));
}

.off-banner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: hsl(var(--destructive) / 10%);
  border: 1px solid hsl(var(--destructive) / 45%);
  border-radius: 14px;
}

.off-banner b {
  color: hsl(var(--destructive));
}

.off-banner span,
.remark span,
.foot-bar p,
.foot-note {
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.remark {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.remark :deep(textarea) {
  border-radius: 12px;
}

.foot-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.foot-bar p,
.foot-note {
  margin: 0;
}

.foot-actions {
  display: flex;
  flex: none;
  gap: 8px;
  margin-left: auto;
}
</style>

<style>
.product-audit-modal .ant-modal {
  top: 24px;
  padding-bottom: 0;
}

.product-audit-modal .ant-modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 22px;
  box-shadow: 0 28px 80px hsl(0deg 0% 0% / 42%);
}

.product-audit-modal .ant-modal-header {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

.product-audit-modal .ant-modal-title {
  display: none;
}

.product-audit-modal .ant-modal-body {
  padding: 0;
}

.product-audit-modal .ant-modal-close {
  color: hsl(var(--foreground));
}
</style>
