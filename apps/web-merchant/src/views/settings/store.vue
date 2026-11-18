<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Input, message, Select } from 'ant-design-vue';

import { requestClient } from '#/api/request';

const form = ref({
  address: '',
  contact: '',
  cutoff: '',
  hours: '',
  merchant: '',
  mobile: '',
  shopName: '',
  status: '营业中',
});
const saving = ref(false);

async function load() {
  form.value = await requestClient.get<typeof form.value>('/store');
}

async function save() {
  saving.value = true;
  try {
    form.value = await requestClient.put<typeof form.value>(
      '/store',
      form.value,
    );
    message.success('店铺资料已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page title="店铺设置">
    <p class="muted">一商户对应一个店铺。这里维护对外展示的门店资料。</p>
    <div class="form">
      <label>商户名称<Input :value="form.merchant" disabled /></label>
      <label>店铺名称<Input v-model:value="form.shopName" /></label>
      <label>联系人<Input v-model:value="form.contact" /></label>
      <label>联系电话<Input v-model:value="form.mobile" /></label>
      <label>营业时间<Input
          v-model:value="form.hours"
          placeholder="例如 08:00-21:00"
      /></label>
      <label>截单时间<Input v-model:value="form.cutoff" placeholder="14:00" /></label>
      <label>地址<Input v-model:value="form.address" /></label>
      <label>状态
        <Select
          v-model:value="form.status"
          :options="[
            { label: '营业中', value: '营业中' },
            { label: '休息', value: '休息' },
          ]"
        />
      </label>
      <Button :loading="saving" type="primary" @click="save">保存</Button>
    </div>
  </Page>
</template>

<style scoped>
.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.form {
  display: grid;
  gap: 12px;
  max-width: 520px;
  margin-top: 16px;
}

label {
  display: grid;
  gap: 6px;
}
</style>
