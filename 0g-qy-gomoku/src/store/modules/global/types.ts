export interface ServiceStructOutput {
  provider: string
  serviceType: string
  url: string
  inputPrice: bigint
  outputPrice: bigint
  updatedAt: bigint
  model: string
  verifiability: string
}

export interface ModelsResponse {
  status: string
  data: (string | bigint)[][]
}
