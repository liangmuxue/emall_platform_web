export type SpecDraft = {
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

export type GoodsDraft = {
  detailHtml: string;
  form: {
    categoryId: number | undefined;
    fakeSold: number | undefined;
    imageUrls: string[];
    productName: string;
    specImages: boolean;
    specs: SpecDraft[];
    spuNo: string;
  };
  reached: number;
  salesStatus: string;
  servicesHtml: string;
  soldCount: number;
  step: number;
};

export const goodsEditDrafts = new Map<string, GoodsDraft>();

let freshPublish = false;

export function requestFreshPublish() {
  freshPublish = true;
  goodsEditDrafts.delete('/goods/edit');
}

export function consumeFreshPublish() {
  const fresh = freshPublish;
  freshPublish = false;
  return fresh;
}
