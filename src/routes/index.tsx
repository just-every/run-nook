import {useEditorLeafReady} from '../base/modules/editor/src/react'
import {OwnerShell} from '../editor/OwnerShell'
import { createFileRoute } from '@tanstack/react-router'
import { Homepage } from '../homepage/Homepage'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Nook — Talk it through. Get it done.' },
      { name: 'description', content: '100% free, open source alternative to Slack and Microsoft Teams. Turn a message into a decision or a request. Everyone can see who’s on it.' },
    ],
  }),
  component: PublicHomepage,
})

function PublicHomepage(){useEditorLeafReady('/');return <><Homepage/><OwnerShell/></>}
