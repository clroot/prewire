#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'

const codegen = defineCommand({
  meta: {
    name: 'codegen',
    description: 'Scan @Injectable classes and generate container wiring (container.gen.ts)',
  },
  args: {
    project: {
      type: 'string',
      description: 'Path to tsconfig.json',
      default: 'tsconfig.json',
    },
    watch: {
      type: 'boolean',
      description: 'Watch mode',
      default: false,
    },
  },
  run({ args }) {
    // TODO(M1): ts-morph로 @Injectable/포트 토큰을 스캔해 wiring 코드 생성
    //  1. tsconfig 로드 → 소스 그래프 분석
    //  2. environment(client/server) 조건부 바인딩 분리
    //  3. 그래프 검증(바인딩 누락 = 에러) 후 container.gen.ts 방출
    console.error(
      `[prewire] codegen is not implemented yet (project=${args.project}, watch=${args.watch})`,
    )
    process.exitCode = 1
  },
})

const main = defineCommand({
  meta: {
    name: 'prewire',
    description:
      'Compile-time DI for frontend frameworks — wired at build time, zero runtime container',
  },
  subCommands: {
    codegen,
  },
})

await runMain(main)
