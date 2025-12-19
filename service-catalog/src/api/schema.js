import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);

const MetadataSchema = z
  .object({
    createdAt: z.string().optional(), // ISO date recommended
    updatedAt: z.string().optional(),
    version: z.string().optional()
  })
  .passthrough(); // allow extra metadata fields

const ContractSchema = z
  .object({
    role: z.string().optional(),
    protocol: z.string().optional(),
    url: z.string().optional()
  })
  .passthrough();

const DependencySchema = z
  .object({
    name: NonEmptyString,
    role: z.string().optional(),
    protocol: z.string().optional()
  })
  .passthrough();

const EventSchema = z
  .object({
    name: NonEmptyString,
    description: z.string().optional()
  })
  .passthrough();

export const ServiceSchema = z
  .object({
    name: NonEmptyString,

    domain: z.string().optional(),
    team: z.string().optional(),
    owner: z.string().optional(),
    repo: z.string().optional(),
    vision: z.string().optional(),

    contracts: z.array(ContractSchema).optional(),

    dependencies: z
      .object({
        critical: z.array(DependencySchema).optional(),
        "non-critical": z.array(DependencySchema).optional()
      })
      .optional(),

    events: z
      .object({
        producing: z.array(EventSchema).optional(),
        consuming: z.array(EventSchema).optional()
      })
      .optional(),

    metadata: MetadataSchema.optional()
  })
  .strict(); // reject unknown top-level fields