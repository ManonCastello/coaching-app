import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ValidatedDayBalance from './ValidatedDayBalance';

test('renders the server total exactly once even when the saved client balance differs',()=>{
  const html=renderToStaticMarkup(<ValidatedDayBalance entry={{locked:true,dailyBalance:550,balanceCalculation:{state:'validated',carry:350,delta:100,total:450,target:2000,intake:2100}}}/>);
  expect(html).toContain('Solde validé : +450 kcal');
  expect(html).not.toContain('550');
  expect(html).toContain('Report précédent');
  expect(html).toContain('+350 kcal');
});
test('pending carry never becomes a zero or a valid total',()=>{
  const html=renderToStaticMarkup(<ValidatedDayBalance entry={{locked:true,dailyBalance:450,balanceCalculation:{state:'pending',total:null}}}/>);
  expect(html).toContain('En attente de calcul');
  expect(html).not.toContain('+450');
});
test('an open journal never presents a stored stale total as validated',()=>{
  const html=renderToStaticMarkup(<ValidatedDayBalance entry={{locked:false,dailyBalance:450}}/>);
  expect(html).toContain('avant la validation');
  expect(html).not.toContain('450');
});
