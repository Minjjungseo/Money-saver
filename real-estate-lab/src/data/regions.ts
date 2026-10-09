import type { Region, RegionGroup } from '@/store/schema'

/**
 * 기본 행정구역 목록 (가격 데이터 아님).
 * - id는 "시도/시군구" 경로 문자열: CSV 가져오기에서 이름으로 찾기 쉽고 바뀌지 않는다.
 * - 행정코드는 확실한 것만 넣고, 나머지는 null(직접 보완 가능).
 * - 인천은 2026-07-01 행정체제 개편(제물포구·영종구·서해구·검단구 신설) 이후 기준.
 *   기존 시트에 중구·동구·서구 기록이 있으면 가져오기 때 새 구로 매핑해야 한다.
 */

interface SidoDef {
  name: string
  code: string
  group: RegionGroup
  children: (string | [string, string])[]
}

const SIDO: SidoDef[] = [
  {
    name: '서울',
    code: '11',
    group: 'capital',
    children: [
      ['종로구', '11110'], ['중구', '11140'], ['용산구', '11170'], ['성동구', '11200'], ['광진구', '11215'],
      ['동대문구', '11230'], ['중랑구', '11260'], ['성북구', '11290'], ['강북구', '11305'], ['도봉구', '11320'],
      ['노원구', '11350'], ['은평구', '11380'], ['서대문구', '11410'], ['마포구', '11440'], ['양천구', '11470'],
      ['강서구', '11500'], ['구로구', '11530'], ['금천구', '11545'], ['영등포구', '11560'], ['동작구', '11590'],
      ['관악구', '11620'], ['서초구', '11650'], ['강남구', '11680'], ['송파구', '11710'], ['강동구', '11740'],
    ],
  },
  {
    name: '경기',
    code: '41',
    group: 'capital',
    children: [
      '수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시', '동두천시', '안산시', '고양시',
      '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시', '용인시', '파주시',
      '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시', '연천군', '가평군', '양평군',
    ],
  },
  {
    name: '인천',
    code: '28',
    group: 'capital',
    children: ['제물포구', '영종구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서해구', '검단구', '강화군', '옹진군'],
  },
  { name: '부산', code: '26', group: 'metro', children: [] },
  { name: '대구', code: '27', group: 'metro', children: [] },
  { name: '광주', code: '29', group: 'metro', children: [] },
  { name: '대전', code: '30', group: 'metro', children: [] },
  { name: '울산', code: '31', group: 'metro', children: [] },
  { name: '세종', code: '36', group: 'metro', children: [] },
  { name: '충북', code: '43', group: 'local', children: ['청주시', '충주시', '제천시'] },
  { name: '충남', code: '44', group: 'local', children: ['천안시', '아산시', '서산시', '당진시'] },
  { name: '강원', code: '51', group: 'local', children: ['춘천시', '원주시', '강릉시'] },
  { name: '전북', code: '52', group: 'local', children: ['전주시', '익산시', '군산시'] },
  { name: '전남', code: '46', group: 'local', children: ['여수시', '순천시', '목포시', '광양시'] },
  { name: '경북', code: '47', group: 'local', children: ['포항시', '구미시', '경산시'] },
  { name: '경남', code: '48', group: 'local', children: ['창원시', '김해시', '양산시', '진주시'] },
  { name: '제주', code: '50', group: 'local', children: ['제주시', '서귀포시'] },
]

export function buildDefaultRegions(): Region[] {
  const out: Region[] = []
  for (const s of SIDO) {
    out.push({ id: s.name, parentId: null, name: s.name, type: 'sido', adminCode: s.code, group: s.group })
    for (const c of s.children) {
      const [name, code] = typeof c === 'string' ? [c, null] : c
      out.push({ id: `${s.name}/${name}`, parentId: s.name, name, type: 'sigungu', adminCode: code, group: s.group })
    }
  }
  return out
}
