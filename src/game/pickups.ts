export type PickupData = {
  id: string
  kind: 'heal' | 'attack'
  amount: number
  position: [number, number, number]
}
