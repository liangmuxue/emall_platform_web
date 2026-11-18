<script lang="ts" setup>
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watchEffect,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Table,
  TreeSelect,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

import ProductAssistant from './assistant.vue';
import { consumeFreshPublish, goodsEditDrafts } from './draft';

defineOptions({ name: 'GoodsEdit' });

type Category = {
  id: number;
  name: string;
  parentId: null | number;
  status: string;
};

type Spec = {
  imageUrl: string;
  key: string;
  marketPrice?: number;
  memberPrice?: number;
  parentKey: string;
  salePrice?: number;
  skuName: string;
  stock?: number;
  unitName: string;
};

const units = ['份', '斤', '盒', '袋', '瓶', '箱', '只', '组'];
const route = useRoute();
const router = useRouter();
const saving = ref(false);
const step = ref(0);
const reached = ref(0);
const stepTitles = ['基础信息', '规格商品', '图文详情'];
type CategoryNode = {
  children?: CategoryNode[];
  fullLabel: string;
  title: string;
  value: number;
};

const categories = ref<CategoryNode[]>([]);
const shopName = ref('本店');
const cutoff = ref('14:00');
const soldCount = ref(0);
const salesStatus = ref('');
const detailRef = ref<HTMLElement>();
const servicesRef = ref<HTMLElement>();
const detailHtml = ref('');
const servicesHtml = ref('');
const form = reactive({
  categoryId: undefined as number | undefined,
  fakeSold: undefined as number | undefined,
  imageUrls: [] as string[],
  productName: '',
  specImages: true,
  specs: [] as Spec[],
  spuNo: '',
});

const editing = computed(() => Boolean(route.query.id));
let opened = false;
let ready = false;
let opening: null | Promise<void> = null;
const submittable = computed(
  () =>
    !salesStatus.value ||
    ['DRAFT', 'OFF_SHELF', 'REJECTED'].includes(salesStatus.value),
);
watchEffect(() => {
  route.meta.title = editing.value ? '编辑商品' : '发布商品';
});
const tableRows = computed(() => {
  const walk = (parent: string): Spec[] =>
    form.specs.flatMap((item) =>
      (item.parentKey || '') === parent ? [item, ...walk(item.key)] : [],
    );
  return walk('');
});
const leaves = computed(() =>
  form.specs.filter(
    (item) => !form.specs.some((other) => other.parentKey === item.key),
  ),
);
const lead = computed(() => {
  const priced = leaves.value.filter((item) => Number(item.salePrice) > 0);
  const pool = priced.length > 0 ? priced : leaves.value;
  return pool.toSorted(
    (a, b) => Number(a.salePrice || 0) - Number(b.salePrice || 0),
  )[0];
});
const previewPrice = computed(() => Number(lead.value?.salePrice || 0));
const previewOrigin = computed(() => Number(lead.value?.marketPrice || 0));
const previewStock = computed(() =>
  leaves.value.reduce((sum, item) => sum + (Number(item.stock) || 0), 0),
);
const previewSold = computed(
  () => soldCount.value + (Number(form.fakeSold) || 0),
);
const previewImage = computed(
  () => form.imageUrls[0] || lead.value?.imageUrl || '',
);
const columns = computed(() => {
  const base = [{ title: '规格商品', key: 'name', width: 280 }];
  if (form.specImages) base.push({ title: '规格图', key: 'image', width: 88 });
  return [
    ...base,
    { title: '单位', key: 'unit', width: 110 },
    { title: '售价', key: 'sale', width: 120 },
    { title: '划线价', key: 'market', width: 120 },
    { title: '会员价', key: 'member', width: 120 },
    { title: '库存', key: 'stock', width: 110 },
    { title: '操作', key: 'action', width: 170 },
  ];
});

function newKey() {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function blankSpec(parentKey = '', unitName = '份'): Spec {
  return {
    imageUrl: '',
    key: newKey(),
    marketPrice: undefined,
    memberPrice: undefined,
    parentKey,
    salePrice: undefined,
    skuName: '',
    stock: undefined,
    unitName,
  };
}

function depthOf(spec: Spec) {
  let depth = 0;
  let parent = spec.parentKey;
  const seen = new Set<string>();
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    depth += 1;
    parent = form.specs.find((item) => item.key === parent)?.parentKey || '';
  }
  return depth;
}

function hasChildren(key: string) {
  return form.specs.some((item) => item.parentKey === key);
}

function categoryLabel(list: Category[], item: Category) {
  const names = [item.name];
  let parentId = item.parentId;
  while (parentId) {
    const parent = list.find((row) => row.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(' / ');
}

function checkImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    message.error('图片格式仅支持 JPG、PNG 或 WebP');
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error('图片不能超过 5MB，请压缩后重新上传');
    return false;
  }
  return true;
}

async function uploadFile(file: File) {
  const result = await requestClient.upload<{ url: string }>(
    '/uploads',
    { file },
    { timeout: 60_000 },
  );
  return result.url;
}

async function addAlbum(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !checkImage(file) || form.imageUrls.length >= 5) return;
  form.imageUrls.push(await uploadFile(file));
}

async function replaceAlbum(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !checkImage(file)) return;
  form.imageUrls[index] = await uploadFile(file);
}

async function uploadSpec(spec: Spec, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !checkImage(file)) return;
  spec.imageUrl = await uploadFile(file);
}

function addChild(parent: Spec) {
  if (depthOf(parent) > 0) return;
  const child = blankSpec(parent.key, '份');
  if (hasChildren(parent.key)) {
    const sibling = form.specs.find(
      (item) => item.parentKey === parent.key && item.unitName,
    );
    child.unitName = sibling?.unitName || '份';
  } else {
    child.unitName = parent.unitName || '份';
    child.salePrice = parent.salePrice;
    child.marketPrice = parent.marketPrice;
    child.memberPrice = parent.memberPrice;
    child.stock = parent.stock;
    parent.unitName = '';
    parent.salePrice = undefined;
    parent.marketPrice = undefined;
    parent.memberPrice = undefined;
    parent.stock = undefined;
  }
  form.specs.push(child);
}

function removeSpec(key: string) {
  const node = form.specs.find((item) => item.key === key);
  if (!node) return;
  const leaf = !hasChildren(key);
  const parentKey = node.parentKey;
  const siblingCount = form.specs.filter(
    (item) => item.parentKey === parentKey && item.key !== key,
  ).length;
  const drop = new Set<string>();
  const walk = (id: string) => {
    drop.add(id);
    form.specs
      .filter((item) => item.parentKey === id)
      .forEach((item) => walk(item.key));
  };
  walk(key);
  form.specs = form.specs.filter((item) => !drop.has(item.key));
  if (leaf && parentKey && siblingCount === 0) {
    const parent = form.specs.find((item) => item.key === parentKey);
    if (!parent) return;
    parent.unitName = node.unitName || '份';
    parent.salePrice = node.salePrice;
    parent.marketPrice = node.marketPrice;
    parent.memberPrice = node.memberPrice;
    parent.stock = node.stock;
  }
}

function runCommand(
  editor: HTMLElement | undefined,
  command: string,
  value?: string,
) {
  if (!editor) return;
  editor.focus();
  document.execCommand(command, false, value);
  syncEditors();
}

async function insertImage(editor: HTMLElement | undefined, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !editor || !checkImage(file)) return;
  const url = await uploadFile(file);
  editor.focus();
  document.execCommand('insertHTML', false, `<img src="${url}" alt="" />`);
  syncEditors();
}

function htmlOf(editor: HTMLElement | undefined) {
  if (!editor) return '';
  const text = (editor.textContent || '').replaceAll('\u00A0', ' ').trim();
  if (!text && !editor.querySelector('img')) return '';
  return editor.innerHTML;
}

function syncEditors() {
  detailHtml.value = htmlOf(detailRef.value);
  servicesHtml.value = htmlOf(servicesRef.value);
}

function paint(editor: HTMLElement | undefined, event: Event) {
  const input = event.target as HTMLInputElement;
  runCommand(editor, 'foreColor', input.value);
  syncEditors();
}

function moneyText(value: number) {
  return value > 0 ? value.toFixed(2) : '--';
}

function categoryTree(list: Category[]) {
  const enabled = list.filter((item) => item.status === 'ENABLED');
  const nodes = new Map<number, CategoryNode>();
  enabled.forEach((item) => {
    nodes.set(item.id, {
      fullLabel: categoryLabel(list, item),
      title: item.name,
      value: item.id,
    });
  });
  const roots: CategoryNode[] = [];
  enabled.forEach((item) => {
    const node = nodes.get(item.id);
    if (!node) return;
    const parent = item.parentId ? nodes.get(item.parentId) : undefined;
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

async function loadCategories() {
  const list = await requestClient.get<Category[]>('/categories');
  categories.value = categoryTree(list);
}

async function loadShop() {
  const shop = await requestClient.get<{ cutoff?: string; shopName: string }>(
    '/shop',
  );
  shopName.value = shop.shopName || '本店';
  cutoff.value = shop.cutoff || '14:00';
}

async function loadProduct(id: string) {
  const product = await requestClient.get<{
    categoryId: number;
    detail?: string;
    fakeSold?: number;
    imageUrls?: string[];
    productName: string;
    services?: string;
    skus: Array<Spec & { parentKey?: string }>;
    specImages?: boolean;
    salesStatus?: string;
    spuNo: string;
    soldCount?: number;
  }>(`/products/${id}`);
  form.productName = product.productName;
  form.spuNo = product.spuNo;
  form.categoryId = product.categoryId;
  form.fakeSold = product.fakeSold || undefined;
  form.imageUrls = product.imageUrls || [];
  form.specImages = product.specImages !== false;
  salesStatus.value = product.salesStatus || '';
  soldCount.value = product.soldCount || 0;
  form.specs = (product.skus || []).map((sku) => ({
    ...blankSpec(sku.parentKey || ''),
    ...sku,
    key: sku.key,
    marketPrice: sku.marketPrice || undefined,
    memberPrice: sku.memberPrice || undefined,
    parentKey: sku.parentKey || '',
  }));
  await nextTick();
  if (detailRef.value) detailRef.value.innerHTML = product.detail || '';
  if (servicesRef.value) servicesRef.value.innerHTML = product.services || '';
  syncEditors();
}

function flatCategories(
  nodes: CategoryNode[],
  result: { id: number; name: string }[] = [],
) {
  nodes.forEach((node) => {
    result.push({ id: node.value, name: node.fullLabel });
    if (node.children?.length) flatCategories(node.children, result);
  });
  return result;
}

function assistantDraft() {
  return {
    productName: form.productName,
    categoryId: form.categoryId ?? null,
    categories: flatCategories(categories.value),
    spuNo: form.spuNo,
    fakeSold: form.fakeSold ?? null,
    imageCount: form.imageUrls.length,
    specImages: form.specImages,
    specs: form.specs.map((spec) => ({
      skuName: spec.skuName,
      parentName:
        form.specs.find((item) => item.key === spec.parentKey)?.skuName || '',
      unitName: spec.unitName,
      salePrice: spec.salePrice ?? null,
      marketPrice: spec.marketPrice ?? null,
      memberPrice: spec.memberPrice ?? null,
      stock: spec.stock ?? null,
    })),
    detail: (detailRef.value?.innerText || '').slice(0, 1500),
    services: (servicesRef.value?.innerText || '').slice(0, 800),
  };
}

function applyAssistant(product: Record<string, any>) {
  if (product.productName)
    form.productName = String(product.productName).slice(0, 60);
  if (product.categoryId) form.categoryId = Number(product.categoryId);
  if (product.spuNo) form.spuNo = String(product.spuNo);
  if (product.fakeSold !== undefined && product.fakeSold !== null)
    form.fakeSold = Number(product.fakeSold);
  if (typeof product.specImages === 'boolean')
    form.specImages = product.specImages;
  if (Array.isArray(product.imageUrls)) {
    product.imageUrls.forEach((url: string) => {
      if (form.imageUrls.length < 5 && url && !form.imageUrls.includes(url))
        form.imageUrls.push(url);
    });
  }
  if (Array.isArray(product.specs) && product.specs.length > 0) {
    const images = new Map(
      form.specs.map((spec) => [
        `${form.specs.find((item) => item.key === spec.parentKey)?.skuName || ''}/${spec.skuName}`,
        spec.imageUrl,
      ]),
    );
    const keys = new Map<string, string>();
    const next: Spec[] = [];
    const fill = (
      row: Record<string, any>,
      parentKey: string,
      parentName: string,
    ) => {
      const spec = blankSpec(parentKey, row.unitName || '份');
      spec.skuName = String(row.skuName || '');
      spec.imageUrl = images.get(`${parentName}/${spec.skuName}`) || '';
      if (row.salePrice !== undefined && row.salePrice !== null)
        spec.salePrice = Number(row.salePrice);
      if (row.marketPrice !== undefined && row.marketPrice !== null)
        spec.marketPrice = Number(row.marketPrice);
      if (row.memberPrice !== undefined && row.memberPrice !== null)
        spec.memberPrice = Number(row.memberPrice);
      if (row.stock !== undefined && row.stock !== null)
        spec.stock = Number(row.stock);
      return spec;
    };
    product.specs.forEach((row: Record<string, any>) => {
      if (row.parentName) return;
      const spec = fill(row, '', '');
      keys.set(spec.skuName, spec.key);
      next.push(spec);
    });
    product.specs.forEach((row: Record<string, any>) => {
      const parentName = String(row.parentName || '');
      if (!parentName) return;
      next.push(fill(row, keys.get(parentName) || '', parentName));
    });
    next.forEach((spec) => {
      if (next.some((item) => item.parentKey === spec.key)) {
        spec.unitName = '';
        spec.salePrice = undefined;
        spec.marketPrice = undefined;
        spec.memberPrice = undefined;
        spec.stock = undefined;
      }
    });
    form.specs = next;
  }
  if (
    product.detail !== undefined &&
    product.detail !== null &&
    detailRef.value
  )
    detailRef.value.innerHTML = String(product.detail);
  if (
    product.services !== undefined &&
    product.services !== null &&
    servicesRef.value
  )
    servicesRef.value.innerHTML = String(product.services);
  syncEditors();
  reached.value = 2;
}

function payload() {
  return {
    categoryId: form.categoryId,
    detail: htmlOf(detailRef.value),
    fakeSold: form.fakeSold || 0,
    imageUrls: form.imageUrls,
    productName: form.productName.trim(),
    services: htmlOf(servicesRef.value),
    skus: form.specs.map((sku) => {
      const group = hasChildren(sku.key);
      return {
        imageUrl: form.specImages ? sku.imageUrl : '',
        key: sku.key,
        marketPrice: group ? null : sku.marketPrice,
        memberPrice: group ? null : sku.memberPrice,
        parentKey: sku.parentKey,
        salePrice: group ? null : sku.salePrice,
        skuName: sku.skuName,
        stock: group ? null : sku.stock,
        unitName: group ? null : sku.unitName,
      };
    }),
    specImages: form.specImages,
    spuNo: form.spuNo.trim(),
  };
}

function scrollForm() {
  document
    .querySelector('[data-layout-region="page-content"]')
    ?.scrollTo({ top: 0 });
}

function validateStep(index: number) {
  if (index === 0) {
    if (!form.productName.trim()) {
      message.warning('请填写商品名称');
      return false;
    }
    if (!form.categoryId) {
      message.warning('请选择所属类目');
      return false;
    }
    if (!form.spuNo.trim()) {
      message.warning('请填写商品货号');
      return false;
    }
    return true;
  }
  if (index !== 1) return true;
  if (form.specs.length === 0) {
    message.warning('请至少添加一个规格商品');
    return false;
  }
  for (const spec of form.specs) {
    if (!spec.skuName.trim()) {
      message.warning('请填写规格名称');
      return false;
    }
    if (hasChildren(spec.key)) continue;
    if (!spec.unitName) {
      message.warning(`请选择「${spec.skuName}」的单位`);
      return false;
    }
    if (!(Number(spec.salePrice) > 0)) {
      message.warning(`「${spec.skuName}」的售价必须大于 0`);
      return false;
    }
    if (spec.marketPrice && spec.marketPrice < Number(spec.salePrice)) {
      message.warning(`「${spec.skuName}」的划线价应大于或等于售价`);
      return false;
    }
    if (
      spec.memberPrice &&
      (spec.memberPrice <= 0 || spec.memberPrice > Number(spec.salePrice))
    ) {
      message.warning(`「${spec.skuName}」的会员价应大于 0 且不高于售价`);
      return false;
    }
    if (spec.stock === undefined || spec.stock === null || spec.stock < 0) {
      message.warning(`请填写「${spec.skuName}」的库存`);
      return false;
    }
  }
  return true;
}

async function startNewProduct() {
  form.categoryId = undefined;
  form.fakeSold = undefined;
  form.imageUrls = [];
  form.productName = '';
  form.specImages = true;
  form.specs = [];
  form.spuNo = `SP${String(Date.now()).slice(-6)}`;
  step.value = 0;
  reached.value = 0;
  salesStatus.value = '';
  soldCount.value = 0;
  detailHtml.value = '';
  servicesHtml.value = '';
  await nextTick();
  if (detailRef.value) {
    detailRef.value.innerHTML = '<p>商品经严格筛选，支持到店自提。</p>';
  }
  if (servicesRef.value) {
    servicesRef.value.innerHTML =
      '<ul><li>100%正品保证</li><li>精挑细选</li><li>售后无忧</li></ul>';
  }
  syncEditors();
}

function nextStep() {
  if (!validateStep(step.value) || step.value >= 2) return;
  step.value += 1;
  reached.value = Math.max(reached.value, step.value);
  scrollForm();
}

function goStep(index: number) {
  if (index > reached.value || index === step.value) return;
  step.value = index;
  scrollForm();
}

async function save(submit: boolean) {
  if (!validateStep(0)) {
    step.value = 0;
    return;
  }
  if (!validateStep(1)) {
    step.value = 1;
    return;
  }
  saving.value = true;
  try {
    const id = route.query.id;
    const saved = await (id
      ? requestClient.put<{ id: number }>(`/products/${id}`, payload())
      : requestClient.post<{ id: number }>('/products', payload()));
    if (submit) await requestClient.post(`/products/${saved.id}/submit`);
    let notice = '已保存';
    if (submit) notice = '已提交审核';
    else if (salesStatus.value === 'ON_SALE')
      notice = '已保存，顾客看到的商品已更新';
    message.success(notice);
    if (!id) {
      goodsEditDrafts.delete(route.fullPath);
      await startNewProduct();
    }
    router.push('/goods/products');
  } finally {
    saving.value = false;
  }
}

async function openPage() {
  if (opening) return opening;
  opening = openPageNow().finally(() => {
    opening = null;
  });
  return opening;
}

async function openPageNow() {
  const fresh = consumeFreshPublish();
  if (!opened) {
    await Promise.all([loadCategories(), loadShop()]);
    opened = true;
  }
  if (route.query.id) {
    if (ready && !fresh) return;
    await loadProduct(String(route.query.id));
    reached.value = 2;
    ready = true;
    return;
  }
  if (ready && !fresh) return;
  goodsEditDrafts.delete(route.fullPath);
  await startNewProduct();
  ready = true;
}

onMounted(() => {
  void openPage();
});

onActivated(() => {
  void openPage();
});

onBeforeUnmount(() => {
  goodsEditDrafts.delete(route.fullPath);
});
</script>

<template>
  <Page
    auto-content-height
    :description="
      editing
        ? '可以回到前面的步骤修改，完成后保存或提交审核。'
        : '按步骤填写，右侧是顾客在小程序里看到的商品详情。'
    "
    footer-fixed
    :title="editing ? '编辑商品' : '发布商品'"
  >
    <div class="wizard">
      <nav class="rail" aria-label="填写步骤">
        <button
          v-for="(title, index) in stepTitles"
          :key="title"
          type="button"
          class="rail-item"
          :class="{
            current: step === index,
            done: index < step,
            ready: index > step && index <= reached,
          }"
          :disabled="index > reached"
          @click="goStep(index)"
        >
          <span class="no">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="label">{{ title }}</span>
          <svg
            v-if="index < step"
            class="tick"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M3.2 8.2 6.4 11.4 12.8 4.6" />
          </svg>
        </button>
      </nav>
      <div class="editor">
        <div class="main">
          <Card v-show="step === 0" class="section" title="基础信息">
            <p class="hint">名称、类目和商品主图对所有规格共用</p>
            <div class="fields">
              <label class="field span-2">
                <span>商品名称</span>
                <Input
                  v-model:value="form.productName"
                  :maxlength="60"
                  placeholder="例如：新黄心土豆"
                />
              </label>
              <div class="field">
                <span>所属类目</span>
                <TreeSelect
                  v-model:value="form.categoryId"
                  class="w-full"
                  :dropdown-style="{ maxHeight: '360px', overflow: 'auto' }"
                  placeholder="选择平台已启用的类目"
                  popup-class-name="category-tree-dropdown"
                  show-search
                  tree-default-expand-all
                  :tree-data="categories"
                  tree-node-filter-prop="title"
                  tree-node-label-prop="fullLabel"
                />
                <p class="help">类目由平台维护，商家只能选择。</p>
              </div>
              <label class="field">
                <span>商品货号</span>
                <Input v-model:value="form.spuNo" />
              </label>
              <label class="field span-2">
                <span>基础已售</span>
                <InputNumber
                  v-model:value="form.fakeSold"
                  :min="0"
                  :precision="0"
                  class="sold-input"
                  placeholder="0"
                />
                <p class="help">
                  顾客看到的已售 = 真实销量 + 这里填写的数量，不填为 0。
                </p>
              </label>
              <div class="field span-2">
                <span>商品图片 <em>{{ form.imageUrls.length }}/5</em></span>
                <div class="album">
                  <div
                    v-for="(url, index) in form.imageUrls"
                    :key="`${url}-${index}`"
                    class="slot"
                  >
                    <img :src="url" alt="" />
                    <b v-if="index === 0">主图</b>
                    <button
                      type="button"
                      @click="form.imageUrls.splice(index, 1)"
                    >
                      ×
                    </button>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="更换商品图片"
                      type="file"
                      @change="replaceAlbum(index, $event)"
                    />
                  </div>
                  <label v-if="form.imageUrls.length < 5" class="slot empty">
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="上传商品图片"
                      type="file"
                      @change="addAlbum"
                    />
                    <span>+</span>
                    <small>上传图片</small>
                  </label>
                </div>
                <p class="help">
                  第一张是列表封面。建议 1:1，JPG、PNG、WebP，单张不超过 5MB。
                </p>
              </div>
            </div>
          </Card>

          <Card v-show="step === 1" class="section" title="规格商品树">
            <template #extra>
              <Button
                type="primary"
                ghost
                @click="form.specs.push(blankSpec())"
              >
                添加一级规格
              </Button>
            </template>
            <p class="hint">
              最多两级。没有下级的行才填写单位、价格和库存；一级规格加上子规格后，这些内容改由第二级填写。
            </p>
            <div class="option-line">
              <Checkbox v-model:checked="form.specImages">
                为每个规格商品上传图片
              </Checkbox>
            </div>
            <Table
              v-if="tableRows.length"
              class="spec-table"
              :columns="columns"
              :data-source="tableRows"
              :pagination="false"
              :scroll="{ x: 1100 }"
              row-key="key"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <div
                    class="spec-name"
                    :style="{ paddingLeft: `${depthOf(record) * 20}px` }"
                  >
                    <i :class="depthOf(record) ? 'branch' : 'root'"></i>
                    <Input
                      v-model:value="record.skuName"
                      placeholder="规格名称"
                    />
                    <em :class="hasChildren(record.key) ? 'parent' : 'leaf'">
                      {{ hasChildren(record.key) ? '分组' : '可售' }}
                    </em>
                  </div>
                </template>
                <template v-else-if="column.key === 'image'">
                  <label class="photo">
                    <img v-if="record.imageUrl" :src="record.imageUrl" alt="" />
                    <span v-else>上传</span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="上传规格图片"
                      type="file"
                      @change="uploadSpec(record, $event)"
                    />
                  </label>
                </template>
                <template v-else-if="column.key === 'unit'">
                  <span v-if="hasChildren(record.key)" class="by-child">由下级填写</span>
                  <Select
                    v-else
                    v-model:value="record.unitName"
                    :options="
                      units.map((item) => ({ label: item, value: item }))
                    "
                  />
                </template>
                <template v-else-if="column.key === 'sale'">
                  <span v-if="hasChildren(record.key)" class="by-child">—</span>
                  <InputNumber
                    v-else
                    v-model:value="record.salePrice"
                    :min="0"
                    placeholder="0.00"
                  />
                </template>
                <template v-else-if="column.key === 'market'">
                  <span v-if="hasChildren(record.key)" class="by-child">—</span>
                  <InputNumber
                    v-else
                    v-model:value="record.marketPrice"
                    :min="0"
                    placeholder="可不填"
                  />
                </template>
                <template v-else-if="column.key === 'member'">
                  <span v-if="hasChildren(record.key)" class="by-child">—</span>
                  <InputNumber
                    v-else
                    v-model:value="record.memberPrice"
                    :min="0"
                    placeholder="可不填"
                  />
                </template>
                <template v-else-if="column.key === 'stock'">
                  <span v-if="hasChildren(record.key)" class="by-child">—</span>
                  <InputNumber
                    v-else
                    v-model:value="record.stock"
                    :min="0"
                    :precision="0"
                    placeholder="0"
                  />
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space>
                    <Button
                      v-if="depthOf(record) === 0"
                      size="small"
                      type="link"
                      @click="addChild(record)"
                    >
                      添加子规格
                    </Button>
                    <Button
                      danger
                      size="small"
                      type="link"
                      @click="removeSpec(record.key)"
                    >
                      删除
                    </Button>
                  </Space>
                </template>
              </template>
            </Table>
            <div v-else class="empty-spec">
              <b>还没有规格</b>
              <p>
                先添加一级规格。需要再分一层时，在该行点击“添加子规格”，价格和库存会移到第二级。
              </p>
              <Button type="primary" @click="form.specs.push(blankSpec())">
                添加一级规格
              </Button>
            </div>
          </Card>

          <Card v-show="step === 2" class="section" title="图文详情">
            <p class="hint">商品介绍和服务承诺支持图文排版，对所有规格共用</p>
            <div class="stack">
              <div class="field">
                <span>商品介绍</span>
                <div class="rich">
                  <div class="toolbar">
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(detailRef, 'bold')"
                    >
                      <b>B</b>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(detailRef, 'italic')"
                    >
                      <i>I</i>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(detailRef, 'underline')"
                    >
                      <u>U</u>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(detailRef, 'strikeThrough')
                      "
                    >
                      <s>S</s>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(detailRef, 'formatBlock', '<h3>')
                      "
                    >
                      标题
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(detailRef, 'formatBlock', '<p>')
                      "
                    >
                      正文
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(detailRef, 'insertUnorderedList')
                      "
                    >
                      列表
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(detailRef, 'insertOrderedList')
                      "
                    >
                      序号
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(detailRef, 'justifyLeft')"
                    >
                      左
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(detailRef, 'justifyCenter')
                      "
                    >
                      中
                    </Button>
                    <input
                      aria-label="文字颜色"
                      type="color"
                      value="#263449"
                      @input="paint(detailRef, $event)"
                    />
                    <label class="tool">
                      图片
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        type="file"
                        @change="insertImage(detailRef, $event)"
                      />
                    </label>
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(detailRef, 'removeFormat')"
                    >
                      清除
                    </Button>
                  </div>
                  <div
                    ref="detailRef"
                    class="body"
                    contenteditable="true"
                    data-placeholder="介绍产地、口感、储存和食用方式，可加粗、分段或插入图片。"
                    @input="syncEditors"
                  ></div>
                </div>
                <p class="help">顾客在商品详情里按这里的排版查看。</p>
              </div>
              <div class="field">
                <span>服务承诺</span>
                <div class="rich">
                  <div class="toolbar">
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(servicesRef, 'bold')"
                    >
                      <b>B</b>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(servicesRef, 'italic')"
                    >
                      <i>I</i>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="runCommand(servicesRef, 'underline')"
                    >
                      <u>U</u>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(servicesRef, 'strikeThrough')
                      "
                    >
                      <s>S</s>
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(servicesRef, 'insertUnorderedList')
                      "
                    >
                      列表
                    </Button>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(servicesRef, 'insertOrderedList')
                      "
                    >
                      序号
                    </Button>
                    <input
                      aria-label="文字颜色"
                      type="color"
                      value="#263449"
                      @input="paint(servicesRef, $event)"
                    />
                    <label class="tool">
                      图片
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        type="file"
                        @change="insertImage(servicesRef, $event)"
                      />
                    </label>
                    <Button
                      size="small"
                      @mousedown.prevent="
                        runCommand(servicesRef, 'removeFormat')
                      "
                    >
                      清除
                    </Button>
                  </div>
                  <div
                    ref="servicesRef"
                    class="body"
                    contenteditable="true"
                    data-placeholder="例如：正品保证、称重退差、售后无忧。可做成列表或配图。"
                    @input="syncEditors"
                  ></div>
                </div>
                <p class="help">所有规格共用同一段服务承诺。</p>
              </div>
            </div>
          </Card>
        </div>
        <aside class="preview">
          <div class="stage">
            <div class="preview-title">顾客看到的商品详情</div>
            <div class="device">
              <i class="side silent"></i>
              <i class="side volume-up"></i>
              <i class="side volume-down"></i>
              <i class="side power"></i>
              <div class="bezel">
                <div class="screen">
                  <div class="status">
                    <span>9:41</span>
                    <i class="island"></i>
                    <span class="signals" aria-hidden="true"><b></b><b></b><s></s></span>
                  </div>
                  <div class="head"><span>‹</span><b>商品详情</b></div>
                  <div class="screen-body">
                    <div class="gallery">
                      <img v-if="previewImage" :src="previewImage" alt="" />
                      <div v-else class="gallery-empty">商品图片</div>
                    </div>
                    <div class="summary">
                      <div class="price-row">
                        <div class="price">
                          <b>¥{{ moneyText(previewPrice) }}</b>
                          <s
                            v-if="
                              previewOrigin > previewPrice && previewPrice > 0
                            "
                            >¥{{ previewOrigin.toFixed(2) }}</s>
                        </div>
                        <em>精选推荐</em>
                      </div>
                      <h3>{{ form.productName || '商品名称' }}</h3>
                      <div class="sold">
                        已售 {{ previewSold }} 份 ·
                        {{ previewStock > 0 ? '库存充足' : '已售罄' }}
                      </div>
                      <div
                        class="trust"
                        v-html="servicesHtml || '暂未填写'"
                      ></div>
                    </div>
                    <div class="card">
                      <div class="row">
                        <b>配送与服务</b><span>{{ cutoff }} 截单，次日可提</span>
                      </div>
                      <p>{{ shopName }} · 商品备货后会短信通知</p>
                    </div>
                    <div class="card">
                      <div class="row">
                        <b>商品介绍</b><span>品质信息</span>
                      </div>
                      <div
                        class="detail"
                        v-html="detailHtml || '暂未填写'"
                      ></div>
                      <div class="points">
                        <span>精心分拣</span><span>规范包装</span><span>售后有保障</span>
                      </div>
                    </div>
                    <div class="card">
                      <div class="row">
                        <b>用户评价（0）</b><span>好评反馈</span>
                      </div>
                      <p class="muted">暂无评价</p>
                    </div>
                  </div>
                  <div class="home"><i></i></div>
                </div>
              </div>
            </div>
            <p class="help center">不含底部的客服、收藏、购物车和购买按钮。</p>
          </div>
        </aside>
      </div>
    </div>
    <ProductAssistant :get-draft="assistantDraft" @apply="applyAssistant" />
    <template #footer>
      <div class="footer">
        <span>{{
          step === 0
            ? '填写名称和类目后进入规格。'
            : step === 1
              ? '可售规格需要单位、售价和库存。'
              : submittable
                ? '确认图文后可以保存草稿或提交审核。'
                : '确认图文后保存，当前状态保持不变。'
        }}</span>
        <Space>
          <Button @click="router.push('/goods/products')">取消</Button>
          <Button v-if="step > 0" @click="goStep(step - 1)">上一步</Button>
          <Button v-if="step < 2" type="primary" @click="nextStep">
            下一步
          </Button>
          <Button
            v-if="step === 2 && submittable"
            :loading="saving"
            @click="save(false)"
          >
            保存草稿
          </Button>
          <Button
            v-if="step === 2 && !submittable"
            :loading="saving"
            type="primary"
            @click="save(false)"
          >
            保存
          </Button>
          <Button
            v-if="step === 2 && submittable"
            :loading="saving"
            type="primary"
            @click="save(true)"
          >
            保存并提交
          </Button>
        </Space>
      </div>
    </template>
  </Page>
</template>

<style scoped>
.wizard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rail {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.rail-item {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 0 22px;
  color: hsl(var(--muted-foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-left: 1px solid hsl(var(--border));
}

.rail-item:first-child {
  border-left: 0;
}

.rail-item:disabled {
  cursor: default;
}

.rail-item .no {
  flex: none;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: hsl(var(--muted-foreground) / 70%);
  letter-spacing: 0.04em;
}

.rail-item .label {
  font-size: 15px;
  font-weight: 600;
}

.rail-item .tick {
  width: 16px;
  height: 16px;
  margin-left: auto;
  fill: none;
  stroke: hsl(var(--primary));
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rail-item.done {
  color: hsl(var(--foreground));
}

.rail-item.done .no {
  color: hsl(var(--primary));
}

.rail-item.ready {
  color: hsl(var(--foreground));
}

.rail-item.ready .no {
  color: hsl(var(--primary));
}

.rail-item.current {
  color: hsl(var(--foreground));
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 18%),
    hsl(var(--primary) / 5%)
  );
}

.rail-item.current .no {
  color: hsl(var(--primary));
}

.rail-item.current::after {
  position: absolute;
  right: 22px;
  bottom: 0;
  left: 22px;
  height: 2px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 2px 2px 0 0;
}

.rail-item.done:hover,
.rail-item.ready:hover {
  background: hsl(var(--accent) / 55%);
}

.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.card-title {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.card-title i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 7px;
}

.hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.help.center {
  margin-top: 12px;
  text-align: center;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 20px;
}

.span-2 {
  grid-column: 1 / -1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field > span {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.field > span em {
  margin-left: 6px;
  font-style: normal;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.field :deep(.ant-select) {
  width: 100%;
}

:global(.category-tree-dropdown) {
  padding: 6px;
}

:global(.category-tree-dropdown .ant-select-tree-treenode) {
  align-items: center;
  width: 100%;
  padding: 2px 0;
}

:global(.category-tree-dropdown .ant-select-tree-switcher) {
  color: hsl(var(--foreground));
}

:global(.category-tree-dropdown .ant-select-tree-indent-unit) {
  position: relative;
  width: 28px !important;
}

:global(.category-tree-dropdown .ant-select-tree-indent-unit::before) {
  position: absolute;
  top: -12px;
  bottom: -12px;
  left: 13px;
  height: auto !important;
  content: '' !important;
  border-left: 1px solid hsl(var(--muted-foreground) / 70%) !important;
}

:global(.category-tree-dropdown .ant-select-tree-node-content-wrapper) {
  min-height: 30px;
  line-height: 30px;
  border-radius: 6px;
}

.sold-input {
  width: 160px;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.album {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.slot {
  position: relative;
  width: 112px;
  height: 112px;
  overflow: hidden;
  background: hsl(var(--accent) / 45%);
  border: 1px dashed hsl(var(--border));
  border-radius: 12px;
  transition: border-color 0.15s;
}

.slot:hover {
  border-color: hsl(var(--primary));
}

.slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.slot b {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 2;
  padding: 1px 7px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 999px;
}

.slot button {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 22px;
  height: 22px;
  line-height: 20px;
  color: #fff;
  cursor: pointer;
  background: rgb(16 24 40 / 62%);
  border: 0;
  border-radius: 11px;
}

.slot input {
  position: absolute;
  inset: 0;
  z-index: 1;
  cursor: pointer;
  opacity: 0;
}

.slot.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.slot.empty span {
  font-size: 28px;
  line-height: 1;
  color: hsl(var(--primary));
}

.slot.empty small {
  font-size: 12px;
}

.option-line {
  padding: 8px 12px;
  margin-bottom: 12px;
  background: hsl(var(--accent) / 55%);
  border-radius: 8px;
}

.spec-name {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 220px;
}

.spec-name .root,
.spec-name .branch {
  flex: none;
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 8px;
}

.spec-name .branch {
  background: transparent;
  box-shadow: inset 0 0 0 2px hsl(var(--primary));
}

.spec-name em {
  flex: none;
  padding: 0 7px;
  font-size: 12px;
  font-style: normal;
  line-height: 20px;
  border-radius: 999px;
}

.spec-name em.leaf {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 14%);
}

.spec-name em.parent {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
}

.by-child {
  color: hsl(var(--muted-foreground));
}

.spec-table :deep(.ant-input-number),
.spec-table :deep(.ant-select) {
  width: 100%;
}

.photo {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent) / 40%);
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo input {
  position: absolute;
  inset: 0;
  cursor: pointer;
  opacity: 0;
}

.empty-spec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 36px 16px;
  text-align: center;
  background: hsl(var(--accent) / 35%);
  border: 1px dashed hsl(var(--border));
  border-radius: 12px;
}

.empty-spec b {
  font-size: 15px;
}

.empty-spec p {
  max-width: 460px;
  margin: 0 0 4px;
  color: hsl(var(--muted-foreground));
}

.rich {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.rich:focus-within {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 16%);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px;
  background: hsl(var(--accent) / 45%);
  border-bottom: 1px solid hsl(var(--border));
}

.toolbar input[type='color'] {
  width: 28px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
}

.tool {
  position: relative;
  padding: 0 8px;
  overflow: hidden;
  line-height: 24px;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.tool input {
  position: absolute;
  inset: 0;
  cursor: pointer;
  opacity: 0;
}

.body {
  min-height: 140px;
  padding: 12px 14px;
  outline: none;
}

.body:empty::before {
  color: hsl(var(--muted-foreground));
  content: attr(data-placeholder);
}

.body :deep(img) {
  max-width: 100%;
}

.footer {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer > span {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.preview {
  position: sticky;
  top: 0;
}

.stage {
  padding: 16px 14px 14px;
  background:
    radial-gradient(
      90% 42% at 50% 0%,
      hsl(var(--primary) / 18%),
      transparent 68%
    ),
    hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.preview-title {
  margin-bottom: 14px;
  font-weight: 650;
  text-align: center;
}

.device {
  position: relative;
  width: 320px;
  max-width: 100%;
  padding: 10px;
  margin: 0 auto;
  background: linear-gradient(165deg, #4a4a4e 0%, #1a1a1c 18%, #0c0c0e 100%);
  border-radius: 46px;
  box-shadow:
    0 22px 48px rgb(16 24 40 / 28%),
    inset 0 0 0 1px #6b6b70,
    inset 0 0 0 3px #2a2a2e;
}

.side {
  position: absolute;
  width: 3px;
  background: #3a3a3e;
  border-radius: 2px;
}

.silent {
  top: 92px;
  left: -2px;
  height: 18px;
}

.volume-up {
  top: 124px;
  left: -2px;
  height: 38px;
}

.volume-down {
  top: 172px;
  left: -2px;
  height: 38px;
}

.power {
  top: 148px;
  right: -2px;
  height: 58px;
}

.bezel {
  padding: 2px;
  background: #050505;
  border-radius: 38px;
}

.screen {
  display: flex;
  flex-direction: column;
  height: 620px;
  max-height: calc(100vh - 220px);
  overflow: hidden;
  color: #1d2939;
  background: #f6f7f8;
  border-radius: 34px;
}

.status {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 18px 0 22px;
  font-size: 12px;
  font-weight: 700;
  color: #1d2939;
  background: #fff;
}

.island {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 86px;
  height: 22px;
  background: #111;
  border-radius: 12px;
  transform: translateX(-50%);
}

.signals {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 10px;
}

.signals b {
  width: 3px;
  background: #1d2939;
  border-radius: 1px;
}

.signals b:nth-child(1) {
  height: 4px;
}

.signals b:nth-child(2) {
  height: 7px;
}

.signals s {
  width: 16px;
  height: 8px;
  text-decoration: none;
  border: 1.4px solid #1d2939;
  border-radius: 2px;
}

.head {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
  height: 36px;
  padding: 0 10px 4px;
  background: #fff;
}

.head span {
  width: 24px;
  height: 24px;
  line-height: 22px;
  text-align: center;
  background: #f2f4f7;
  border-radius: 12px;
}

.head b {
  flex: 1;
  margin-right: 24px;
  font-size: 15px;
  text-align: center;
}

.screen-body {
  flex: 1;
  overflow: auto;
  background: #f6f7f8;
}

.home {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: 22px;
  background: #f6f7f8;
}

.home i {
  width: 108px;
  height: 4px;
  background: #1d2939;
  border-radius: 4px;
}

.gallery {
  height: 220px;
  background: #fff;
}

.gallery img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 13px;
  color: #98a2b3;
  background: linear-gradient(180deg, #f7f8fa, #eef1f4);
}

.summary {
  padding: 12px;
  margin-top: 6px;
  background: #fff;
}

.card {
  padding: 11px 12px;
  margin: 8px 10px 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 3px 12px rgb(16 24 40 / 4%);
}

.card:last-child {
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price {
  font-weight: 700;
  color: #f3332b;
}

.price b {
  font-size: 22px;
}

.price s {
  margin-left: 6px;
  font-size: 12px;
  color: #c5cad3;
}

.price-row em {
  padding: 2px 6px;
  font-size: 12px;
  font-style: normal;
  color: #ed332b;
  background: #fff0ef;
  border-radius: 4px;
}

.summary h3 {
  margin: 8px 0 4px;
  font-size: 16px;
  color: #20242b;
}

.sold,
.muted {
  font-size: 12px;
  color: #98a2b3;
}

.trust {
  padding-top: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: #68707b;
  border-top: 1px solid #f1f2f4;
}

.row {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.card p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #667085;
}

.points {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #98a2b3;
}

.detail :deep(img) {
  max-width: 100%;
}

.row b {
  color: #20242b;
}

@media (max-width: 1180px) {
  .editor {
    grid-template-columns: 1fr;
  }

  .preview {
    position: static;
  }
}

@media (max-width: 720px) {
  .fields {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }

  .footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
