import { describe, expect, it } from 'vitest'
import { areaBand, jeonseRatio, matchName, normName, pickLatestJeonse, pickLatestSale, similarNames } from './match.mjs'

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

describe('면적 기준', () => {
  it('33~35평만 전용 84㎡대를 확실한 기준으로 쓴다', () => {
    expect(areaBand({ pyeong: 34 })).toMatchObject({ min: 83, max: 86, certain: true })
    expect(areaBand({ pyeong: 32 }).certain).toBe(false)
    expect(areaBand({ pyeongLabel: '35~37평' }).certain).toBe(false)
    expect(areaBand({ pyeong: 32, areaMin: 84, areaMax: 85 })).toMatchObject({ min: 84, max: 85, certain: true })
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
