import type { ServiceStructOutput } from './types'

export function mapModelsResponseToServiceStruct(data: (string | bigint)[][]): ServiceStructOutput[] {
  return data.map(item => ({
    provider: item[0] as string,
    serviceType: item[1] as string,
    url: item[2] as string,
    inputPrice: BigInt(item[3]),
    outputPrice: BigInt(item[4]),
    updatedAt: BigInt(item[5]),
    model: item[6] as string,
    verifiability: item[7] as string,
  }))
}
