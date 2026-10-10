import { describe, expect, it } from 'vitest'
import { areaClusters, chooseAreaType, jeonseRatio, matchName, normName, pickLatestJeonse, pickLatestSale, similarNames, typeWindow } from './match.mjs'

const it_ = (aptName, dong = null) => ({ aptName, dong })

describe('단지명 매칭', () => {
  it('영문 표기·괄호·공백 차이는 같은 이름으로 본다', () => {
    expect(normName('광교중흥S클래스')).toBe(normName('광교 중흥에스클래스'))
    expect(normName('도룡SK뷰')).toBe(normName('도룡에스케이뷰'))
    expect(matchName({ name: '송도더샵퍼스트파크' }, [it_('송도더샵퍼스트파크(F13-1블록)'), it_('송도더샵퍼스트파크(F15블록)'), it_('송도더샵센트럴파크')])).toEqual({
      level: 'exact',
      names: ['송도더샵퍼스트파크(F13-1블록)', '송도더샵퍼스트파크(F15블록)'],
    })
  })
  it('법정동으로 시작하는 시트 이름은 같은 법정동의 단지만 exact', () => {
    const lm = { name: '이촌동 한가람' }
    expect(matchName(lm, [it_('한가람', '이촌동')]).level).toBe('exact')
    expect(matchName(lm, [it_('한가람', '다른동')]).level).toBe('partial')
  })
  it('포함 관계만 맞으면 partial(검증 필요), 직접 적은 apiNames 는 alias', () => {
    expect(matchName({ name: '서울숲힐스테이트' }, [it_('힐스테이트')]).level).toBe('partial')
    expect(matchName({ name: '해운대자이2차' }, [it_('해운대자이2단지')]).level).toBe('none')
    expect(matchName({ name: '해운대자이2차', apiNames: ['해운대자이2단지'] }, [it_('해운대자이2단지')]).level).toBe('alias')
    expect(similarNames('해운대자이2차', ['해운대자이2단지', '롯데캐슬'])).toEqual(['해운대자이2단지'])
  })
})

describe('면적 타입', () => {
  const a = (...areas) => areas.map((area) => ({ area }))
  it('1㎡ 이내로 이어지는 면적은 같은 타입, 그 밖은 다른 타입', () => {
    expect(areaClusters(a(84.95, 84.97, 84.99, 59.9, 114.2, 84.99)).map((c) => [c.min, c.max, c.count])).toEqual([
      [84.95, 84.99, 4],
      [59.9, 59.9, 1],
      [114.2, 114.2, 1],
    ])
  })
  it('평형 후보 범위 안에 타입이 하나면 그 타입만 (확실)', () => {
    const r = chooseAreaType({ pyeong: 34 }, a(59.9, 84.97, 84.99, 114.2))
    expect(r).toMatchObject({ band: { min: 84.97, max: 84.99 }, certain: true })
  })
  it('옛 단지 35평 = 전용 95㎡ 처럼 84가 아닌 경우도 실제 거래 타입으로 잡는다', () => {
    expect(chooseAreaType({ pyeong: 35 }, a(65.08, 95.03, 95.03, 115.7))).toMatchObject({ band: { min: 95.03, max: 95.03 }, certain: true })
  })
  it('후보 타입이 여러 개면 하나만 고르되 확실하지 않음(검증 필요)', () => {
    const r = chooseAreaType({ pyeong: 35 }, a(84.9, 84.9, 95.5, 95.5))
    expect(r.certain).toBe(false)
    expect(r.band).toEqual({ min: 84.9, max: 84.9 })
    expect(r.label).toMatch(/타입 2개/)
  })
  it('평형 범위 표기·평형 없음은 항상 불확실, 직접 지정은 확실', () => {
    expect(chooseAreaType({ pyeongLabel: '35~37평' }, a(84.9)).certain).toBe(false)
    expect(chooseAreaType({}, a(84.9)).certain).toBe(false)
    expect(chooseAreaType({ pyeong: 32, areaMin: 84, areaMax: 85 }, a(59, 84.5))).toMatchObject({ band: { min: 84, max: 85 }, certain: true })
    expect(typeWindow({ pyeong: 34 })).toMatchObject({ min: 78.7, max: 96.7 })
  })
})

describe('단지명 변형', () => {
  it('세종처럼 API에 마을·괄호 브랜드가 붙어도 exact', () => {
    expect(matchName({ name: '새뜸10단지더샵힐스테이트' }, [it_('새뜸마을10단지(더샵힐스테이트)'), it_('새뜸마을11단지')])).toEqual({
      level: 'exact',
      names: ['새뜸마을10단지(더샵힐스테이트)'],
    })
  })
  it('apiNames 를 적으면 그 이름만 쓴다', () => {
    expect(matchName({ name: '해운대자이2차', apiNames: ['해운대자이2단지'] }, [it_('해운대자이2단지'), it_('해운대자이2차')])).toEqual({ level: 'alias', names: ['해운대자이2단지'] })
  })
})

describe('최신 거래 고르기', () => {
  it('해제된 매매는 빼고 건수만 센다', () => {
    const r = pickLatestSale([
      { contractDate: '2026-09-20', priceWon: 6e9, cancelled: true, area: 84.99 },
      { contractDate: '2026-09-10', priceWon: 5e9, cancelled: false, area: 84.99 },
    ])
    expect(r.latest.priceWon).toBe(5e9)
    expect(r).toMatchObject({ count: 1, cancelledCount: 1 })
  })
  it('전세는 월세 0원만, 신규·같은 면적 우선', () => {
    const items = [
      { contractDate: '2026-09-25', depositWon: 1e9, isJeonse: true, contractType: '갱신', area: 84.99 },
      { contractDate: '2026-09-22', depositWon: 9e8, isJeonse: false, area: 84.99 },
      { contractDate: '2026-09-20', depositWon: 1.5e9, isJeonse: true, contractType: '신규', area: 59.9 },
      { contractDate: '2026-09-18', depositWon: 1.6e9, isJeonse: true, contractType: '신규', area: 84.99 },
    ]
    const r = pickLatestJeonse(items, 84.99)
    expect(r.latest.depositWon).toBe(1.6e9)
    expect(r.renewalOnly).toBe(false)
    expect(jeonseRatio({ priceWon: 5e9, area: 84.99 }, r.latest)).toBeCloseTo(32, 5)
    expect(jeonseRatio({ priceWon: 5e9, area: 84.99 }, { depositWon: 1e9, area: 59.9 })).toBeNull()
  })
})
