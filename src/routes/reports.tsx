import {createFileRoute} from '@tanstack/react-router'
import {Reports} from '../reports/Reports'
export const Route=createFileRoute('/reports')({head:()=>({meta:[{title:'Workspace reports · Nook'}]}),component:Reports})
