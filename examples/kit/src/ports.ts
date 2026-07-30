/**
 * Ports of the example product line. Plain TS interfaces — prewire has no
 * opinion about them; apps bind implementations per environment axis.
 */
export interface Logger {
  info(message: string): void
}

export interface RouterPort {
  href(to: string): string
  push(to: string): void
}

export interface BillingPort {
  /** Returns a receipt id. */
  charge(customerId: string, amountCents: number): Promise<string>
}

/** Test knob surface of the kit-provided router fake. */
export interface RouterFake extends RouterPort {
  readonly history: string[]
  reset(): void
}
