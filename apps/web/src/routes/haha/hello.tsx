import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/haha/hello')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/hello/hello"!</div>
}
