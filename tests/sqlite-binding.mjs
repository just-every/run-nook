import {DatabaseSync} from 'node:sqlite';
// Real SQLite transactions behind the D1 transport boundary; no application stub.
// D1 reports total_changes() deltas, including writes performed by triggers.
export function sqliteBinding(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 function prepare(sql){const statement=sqlite.prepare(sql);let values=[];const result=()=>{const before=sqlite.prepare('SELECT total_changes() AS n').get().n;const results=statement.all(...values).map(row=>({...row}));return {results,success:true,meta:{changes:Number(sqlite.prepare('SELECT total_changes() AS n').get().n-before)}}};return {bind(...args){values=args;return this},first(){const row=statement.get(...values);return row?{...row}:null},all:result,run:result}}
 return {sqlite,prepare,batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(statement=>statement.all());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}},close(){sqlite.close()}};
}
