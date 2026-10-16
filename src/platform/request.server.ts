import {AsyncLocalStorage} from 'node:async_hooks'
import {Repository} from './repository.server'

const requests=new AsyncLocalStorage<Repository>()
export const withRepository=<T>(repository:Repository,work:()=>T)=>requests.run(repository,work)
export function requestRepository(){const repository=requests.getStore();if(!repository)throw Error('Missing request repository');return repository}
