import { describe, expect, it } from 'vitest'
import { customerQueueOptions, customerTicketOptions } from './customer-queue'

describe('customer queue cache keys', () => {
  it('scopes queue data to the signed-in customer', () => {
    expect(customerQueueOptions('customer-a').queryKey).not.toEqual(
      customerQueueOptions('customer-b').queryKey,
    )
  })

  it('scopes ticket data to both customer and ticket', () => {
    expect(customerTicketOptions('customer-a', 'ticket-1').queryKey).not.toEqual(
      customerTicketOptions('customer-b', 'ticket-1').queryKey,
    )
    expect(customerTicketOptions('customer-a', 'ticket-1').queryKey).not.toEqual(
      customerTicketOptions('customer-a', 'ticket-2').queryKey,
    )
  })
})
