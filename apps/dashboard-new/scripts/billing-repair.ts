import { getServerBillingProjection } from "@repo/db/helpers/dashboard-billing"

import {
  getPolarConfiguration,
  polarClient,
  reconcilePolarSubscription,
} from "../src/features/dashboard/polar.server"

const [command, id] = process.argv.slice(2)

if (!getPolarConfiguration()) {
  throw new Error("Polar billing environment variables are not configured")
}
if (!id) usage()

if (command === "inspect-server") {
  const projection = await getServerBillingProjection({ serverId: id })
  if (!projection) throw new Error(`Server ${id} was not found`)
  console.log(JSON.stringify(projection, null, 2))
} else if (command === "reconcile-subscription") {
  const subscription = await polarClient.subscriptions.get({ id })
  const result = await reconcilePolarSubscription(subscription)
  console.log(JSON.stringify(result, null, 2))
} else if (command === "reconcile-customer") {
  const state = await polarClient.customers.getStateExternal({ externalId: id })
  const results = []
  for (const summary of state.activeSubscriptions) {
    const subscription = await polarClient.subscriptions.get({ id: summary.id })
    results.push(await reconcilePolarSubscription(subscription))
  }
  console.log(JSON.stringify(results, null, 2))
} else {
  usage()
}

function usage(): never {
  throw new Error(
    "Usage: billing:repair <inspect-server|reconcile-subscription|reconcile-customer> <id>"
  )
}
