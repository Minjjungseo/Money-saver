/**
 * 1차 일괄 조회 대상: 전국 대표 단지 20개 (기존 시트 시세트래킹 탭의 이름 그대로)
 *
 * lawdCd = 법정동코드 앞 5자리(시군구). 국토부 API의 LAWD_CD 값.
 * 조회 결과의 sggCd 가 이 값과 다르거나, 24개월 내내 그 지역 거래가 0건이면
 * batch 가 '지역코드 확인 필요'로 표시한다(코드 오기 방지).
 * 나머지 단지는 server/landmarks.json 에 lawdCd 를 직접 적으면 --all 로 함께 조회된다.
 */
export const TOP20 = [
  { rank: 1, sheetName: '아크로리버파크(34")', lawdCd: '11650', region: '서울 서초구' },
  { rank: 2, sheetName: '래미안라클래시(34")', lawdCd: '11680', region: '서울 강남구' },
  { rank: 3, sheetName: '잠실엘스(33")', lawdCd: '11710', region: '서울 송파구' },
  { rank: 4, sheetName: '이촌동 한가람(33")', lawdCd: '11170', region: '서울 용산구' },
  { rank: 5, sheetName: '서울숲힐스테이트(35")', lawdCd: '11200', region: '서울 성동구' },
  { rank: 6, sheetName: '마포프레스티지자이(34")', lawdCd: '11440', region: '서울 마포구' },
  { rank: 7, sheetName: '목동신시가지5단지(35")', lawdCd: '11470', region: '서울 양천구' },
  { rank: 8, sheetName: '고덕그라시움(34")', lawdCd: '11740', region: '서울 강동구' },
  { rank: 9, sheetName: '과천위버필드(34")', lawdCd: '41290', region: '경기 과천시' },
  { rank: 10, sheetName: '백현마을2단지(32")', lawdCd: '41135', region: '경기 성남시 분당구' },
  { rank: 11, sheetName: '광교중흥S클래스(35")', lawdCd: '41117', region: '경기 수원시 영통구' },
  { rank: 12, sheetName: '송도더샵퍼스트파크(35")', lawdCd: '28185', region: '인천 연수구' },
  { rank: 13, sheetName: '해운대자이2차(33")', lawdCd: '26350', region: '부산 해운대구' },
  { rank: 14, sheetName: '광안쌍용예가디오션(35")', lawdCd: '26500', region: '부산 수영구' },
  { rank: 15, sheetName: '힐스테이트범어(33")', lawdCd: '27260', region: '대구 수성구' },
  { rank: 16, sheetName: '도룡SK뷰(33")', lawdCd: '30200', region: '대전 유성구' },
  { rank: 17, sheetName: '봉선제일풍경채엘리트파크(34")', lawdCd: '29155', region: '광주 남구' },
  { rank: 18, sheetName: '문수로2차아이파크1단지(33")', lawdCd: '31140', region: '울산 남구' },
  { rank: 19, sheetName: '새뜸10단지더샵힐스테이트(34")', lawdCd: '36110', region: '세종' },
  { rank: 20, sheetName: '용지더샵레이크파크(34")', lawdCd: '48123', region: '경남 창원시 성산구' },
]
