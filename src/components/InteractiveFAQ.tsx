'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDownIcon } from '@/components/icons'
import { Surface } from '@/components/Surface'

/**
 * The styled Radix accordion for the FAQ. This module is dynamically imported
 * (ssr:false) by LazyFAQ only AFTER the browser is idle, so the Radix JS never
 * touches the critical load path. The visible styling matches the rest of the
 * app's ui/accordion exactly.
 */

interface FaqItem {
  q: string
  a: string
}

export function InteractiveFAQ({
  items,
  defaultOpenIndex = 0,
}: {
  items: FaqItem[]
  defaultOpenIndex?: number
}) {
  return (
    <AccordionPrimitive.Root
      type='single'
      collapsible
      defaultValue={`faq-${defaultOpenIndex + 1}`}
      className='space-y-3'
    >
      {items.map((f, i) => (
        <Surface
          key={f.q}
          as={AccordionPrimitive.Item}
          value={`faq-${i + 1}`}
          interaction='hover'
          radius='xl'
          className='overflow-hidden'
        >
          <AccordionPrimitive.Header className='flex'>
            <AccordionPrimitive.Trigger className='flex flex-1 items-center justify-between gap-4 px-4 py-4 text-left text-sm md:text-base font-semibold text-white transition-all outline-none hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-0 rounded-lg [&[data-state=open]>svg]:rotate-180'>
              {f.q}
              <ChevronDownIcon className='h-4 w-4 shrink-0 text-white/60 transition-transform duration-200' />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className='overflow-hidden text-sm text-white/75 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'>
            <div className='px-4 pb-4 pt-0 leading-relaxed'>{f.a}</div>
          </AccordionPrimitive.Content>
        </Surface>
      ))}
    </AccordionPrimitive.Root>
  )
}
