// ==UserScript==
// @name         WaniKani Pitch Info
// @include     https://www.wanikani.com/*
// @include     http://www.wanikani.com/*
// @run-at document-end
// @namespace    https://greasyfork.org/en/scripts/31070-wanikani-pitch-info
// @version      0.19
// @description  Grabs Pitch value for a given Vocab from weblio.jp and displays it on a WaniKani vocab or session page.
// @author       Invertex
// @supportURL http://invertex.xyz
// @grant GM_xmlhttpRequest
// @connect weblio.jp/*
// @connect weblio.jp
// ==/UserScript==

/*
	TODO @nasatitan:
		wanikani note: user jjatria
			If what you have is a number, then one way to do this
			would be to split the word into kana, and apply the
			relevant style to the appropriate character. The one
			thing that might be tricky is that compound kana
			shouldbe treated as one.

			It might be helpful to know that so-called
			"defficient"mora (long vowels, ん, and the small っ)
			cannot bear the accent (but are still counted).

		failed responses:
			vocab: Nine
			vocab: To Think Hard (also is an example of 2 acceptable pitch accents)
			vocab: Mountain (gets mistaken for kanji instead of vocab, i believe)
			vocab: Seven (need to separate two readings when parsing innerText for kanaLength)
			some single kanji vocab gets mistaken for kanji instead of vocab

		display multiple pitch patterns on top of each other
*/

var SHOW_PITCH_DESCRIPTION = true;

var vocab = "";
var vocabPitchType = -1;
var savedReading = "";
var sessionReadingElem;
var pitchInfoElem;
var descriptionElem;
var readingElem;
var reading = "";
var pitchInfoLoadTxt = "Loading Pitch info...";
var kanaElem = null;
var kana = null;
var kanaLength = 0;
var kanaPlusParticleLength = 0;
var colorCode = "#000000";

$(document).ready(function()
{
	parsePage();
	
	var observer = new MutationObserver(function(mutations)
	{
		 mutations.forEach(function(mutation)
		 {
			 parsePage();
		 });
	});

	descriptionElem = document.getElementsByClassName('pure-g-r')[0];
	if(descriptionElem != null){
		observer.observe(descriptionElem, {attributes: true, attributeFilter: ['style', 'class'], subtree:true}); 
	}
	readingElem = document.getElementById('supplement-voc-reading');
	if(readingElem != null){
		observer.observe(readingElem, {attributes: true, attributeFilter: ['style', 'class'], subtree:true}); 
	}
	/*    var allInfo = document.getElementById('all-info');
	if(itemInfo != null){
		observer.observe(itemInfo, {attributes: true, attributeFilter: ['style', 'class']}); 
		console.log("all info watch");
	}*/
});

function parsePage()
{
	var tmpVocab = "";
	var tmpSessionElem;
	
	var sessionChar = document.getElementById("character"); //Check for session character
	if(sessionChar != null && ($(sessionChar).hasClass('vocabulary') || $('#main-info').hasClass('vocabulary')))
	{
		var sessionVocElem = sessionChar.getElementsByTagName("span")[0]; //Get sub element that contains the characters.
		if(sessionVocElem != null)
		{
			tmpVocab = sessionVocElem.innerHTML;
			tmpSessionElem = document.getElementById("item-info-reading");
		}
		else //We must be in Lesson session if there is no "span" element, characters are in first element we got.
		{
		   tmpVocab = sessionChar.innerHTML;
		   var descripDivs = document.getElementById("supplement-voc-reading").getElementsByClassName("col1")[0];
		   tmpSessionElem = descripDivs;
		}
	}
	else //Check for Vocab page element
	{
	   var vocabIcon = document.getElementsByClassName("vocabulary-icon")[0];
	   if(vocabIcon != null)
	   {
		   tmpVocab = $(vocabIcon.getElementsByTagName("span")[0]).html();
		   tmpSessionElem = document.getElementsByClassName("vocabulary-reading")[0];
		}
		//Individual Kanji shouldn't be looked for I guess, so deprecated. Uncomment this section if you'd like it to be
		/*else //Must be on a Kanji page instead of Vocab, check for other element
		{
			var kanjiIcon = document.getElementsByClassName("kanji-icon")[0];
			if(kanjiIcon != null)
			{
				vocab = $(kanjiIcon.getElementsByTagName("span")[0]).html();
				var kunYomiDisp = document.getElementsByTagName("H3");
				var kunYomiElem;
				if(kunYomiDisp != null)
				{
					for(i = 0; i < kunYomiDisp.length; i++)
					{
						if(kunYomiDisp[i].innerHTML === "Kun'yomi")
						{
							sessionReadingElem = kunYomiDisp[i].parentNode;
							break;
						}
					}
				}
			}
		}*/
	}
	if(tmpSessionElem != null)
	{
		var spanElem = findChildElemWithAttr(tmpSessionElem, "span", "lang");
		if(spanElem == null){
			spanElem = findChildElemWithAttr(tmpSessionElem, "p", "lang");
		}
		if(spanElem == null){
			spanElem = findChildElemWithAttr(tmpSessionElem, "div", "lang");
		}
		if(spanElem != null){
			reading = spanElem.textContent.replace(/\s+/g, '').split(',')[0];
		}
	}
	if(tmpVocab != null && tmpVocab != "" && !tmpVocab.includes("nbsp") && tmpSessionElem != null && reading != null && reading != "")
	{
		if(!tmpSessionElem.hasAttribute("vocabpitch"))
		{
			tmpSessionElem.setAttribute("vocabpitch", true);
		}
		
		sessionReadingElem = tmpSessionElem;
		pitchInfoElem = sessionReadingElem.getElementsByClassName("pitchInfo")[0];
		
		if(pitchInfoElem == null)
		{
			pitchInfoElem = document.createElement("P");
			pitchInfoElem.className = "pitchInfo";
			sessionReadingElem.appendChild(pitchInfoElem);
			pitchInfoElem.innerHTML = pitchInfoLoadTxt;
			getVocabPitch(tmpVocab);
		}
		else if((pitchInfoElem.innerHTML != pitchInfoLoadTxt && tmpVocab != vocab) || tmpVocab != vocab)
		{
			pitchInfoElem.innerHTML = pitchInfoLoadTxt;
			getVocabPitch(tmpVocab);
		}
	}
}

function findChildElemWithAttr(parentElem, elemType, attrType)
{
	var childElems = parentElem.getElementsByTagName(elemType);
	
	for(i = 0; i < childElems.length; i++)
	{
		if(childElems[i].hasAttribute(attrType))
		{
			return childElems[i];
		}
	}
	return null;
}

function getVocabPitch(inVocab)
{
		vocab = inVocab;

		GM_xmlhttpRequest({
			method: "GET",
			url: "http://www.weblio.jp/content/" + inVocab,
			onload: parseResponse
		});
}

function parseResponse(responseObj)
{
	var dparser = new DOMParser();
	var respDoc = dparser.parseFromString(responseObj.responseText, "text/html").documentElement;
	var vocabResults = respDoc.getElementsByClassName('midashigo');
	
	if(vocabResults != null)
	{
		for(i = 0; i < vocabResults.length; i++)
		{
			var title = $(vocabResults[i]).attr("title");
			if(title == vocab && vocabResults[i].textContent.replace(/\s+/g, '').replace("・","").includes(reading))
			{
				var spans = vocabResults[i].getElementsByTagName("span");
				if(spans != null)
				{
					var numMatch;
					var numMatch2;
					for(s = 0; s < spans.length; s++)
					{
						var spanText = spans[s].textContent;
						if(spanText.includes("［"))
						{
						   var parseNum = parseInt(spanText.match(/\d+/g));
							if(numMatch == null)
							{
								numMatch = parseNum;
							} else if(numMatch2 == null)
							{
								numMatch2 = parseNum;
								break;
							}
						}
					}
					if(numMatch != null)
					{
						vocabPitchType = numMatch;
						writeToPage(numMatch, numMatch2);
						return null;
					}
				}
			}
		}
	}
   vocabPitchType = -1;
   writeToPage(vocabPitchType);
}

function getKanaElemThruSibling(el)
{
	// search for sibling element with lang="ja"
	var tmpKanaElem = null;
	var s = el.parentNode.firstChild;
	while(s)
	{
		if(s.nodeType === 1 && s !== el && s.getAttribute("lang") == "ja")
		{
			tmpKanaElem = s;
			break;
		}
		s = s.nextSibling;
	}
	return tmpKanaElem;
}

function getKanaInfo()
{
	// get information about the kana

	if (pitchInfoElem == null){ return; }

	// Get sibling that contains vocabulary kana
	kanaElem = getKanaElemThruSibling(pitchInfoElem);
	if (kanaElem == null)
	{
		console.log("Failed to find kana element.");
		return;
	}

	// get number of kana
	kana = kanaElem.innerText || null;
	if (kana == null)
	{
		console.log("Failed to find kana innerText.");
		return;
	}

	// remove white space, and count kana
	kana = kana.trim();
	kanaLength = kana.length;
	kanaPlusParticleLength = kanaLength + 1;
}

function getPitchType(pitchNum)
{
	if(pitchNum < 0 || kana == null || kanaElem == null || kanaLength == null)
	{
		return "No pitch value found, click the number for more info.";
	}

	var patternName = "unknown";
	
	// Get the color and the pitch pattern name

	var patternObj = {
		heiban : {
			name: "平板",
			color: "#d20ca3",
		},
		odaka : {
			name: "尾高",
			color: "#0cd24d",
		},
		nakadaka : {
			name: "中高",
			color: "#27a2ff",
		},
		atamadaka : {
			name: "頭高",
			color: "#EA9316",
		}
	};

	if (pitchNum == 0) {
		// pattern 0 is always heiban
		patternName = patternObj.heiban.name;
		colorCode = patternObj.heiban.color;
	}
	else if (pitchNum == 1) {
		// pattern 1 is always atamadaka
		patternName = patternObj.atamadaka.name;
		colorCode = patternObj.atamadaka.color;
	}
	else if (pitchNum == 2) {
		if (kanaLength == 2) {
			patternName = patternObj.odaka.name;
			colorCode = patternObj.odaka.color;
		} else {
			patternName = patternObj.nakadaka.name;
			colorCode = patternObj.nakadaka.color;
		}
	}
	else if (pitchNum == 3) {
		if (kanaLength == 3) {
			patternName = patternObj.odaka.name;
			colorCode = patternObj.odaka.color;
		} else {
			patternName = patternObj.nakadaka.name;
			colorCode = patternObj.nakadaka.color;
		}
	}
	else if (pitchNum == 4) {
		if (kanaLength == 4) {
			patternName = patternObj.odaka.name;
			colorCode = patternObj.odaka.color;
		} else {
			patternName = patternObj.nakadaka.name;
			colorCode = patternObj.nakadaka.color;
		}
	}
	else if (pitchNum == 5) {
		if (kanaLength == 5) {
			patternName = patternObj.odaka.name;
			colorCode = patternObj.odaka.color;
		} else {
			patternName = patternObj.nakadaka.name;
			colorCode = patternObj.nakadaka.color;
		}
	}

	return patternName;
}

function drawPitchDiagram(pitchNum)
{
	/*
		Prepare elements for drawing
	*/

	// use the font size to calculate height and width
	var fontSize =  window.getComputedStyle(kanaElem, null).getPropertyValue('font-size');
	fontSize = parseFloat(fontSize); 
	var svg_w = fontSize * kanaPlusParticleLength;
	var svg_h = fontSize + 10;

	// absolute positioned container
	var pitchDiagram = document.createElement("DIV");
	pitchDiagram.style.position = "absolute";
	pitchDiagram.style.left = "0";
	pitchDiagram.style.top = "0";
	pitchDiagram.style.width = svg_w + "px";
	pitchDiagram.style.height = svg_h + "px";

	// add space to parent element
	kanaElem.style.position = "relative";
	kanaElem.style.paddingTop = fontSize + "px";

	// the svg which will be drawn to
	var namespace = "http://www.w3.org/2000/svg";
	var svg = document.createElementNS(namespace, "svg");
	svg.setAttribute("width",svg_w);
	svg.setAttribute("height",svg_h);

	var w = 5; // dot size

	/*
		Start drawing
	*/

	var points = [];
	function calculatePoints(p,i)
	{
		var cx = ((i * 100) - ((w*2)/svg_w * 100)) + "%";
		var cy = (p == 0) ? "75%" : "15%";
		points.push({"x": cx, "y": cy});
	}

	function drawPitchDot(cx, cy, is_particle)
	{
		var circle = document.createElementNS(namespace, "circle");
		circle.setAttribute("fill", (is_particle) ? "white" : colorCode);
		circle.setAttribute("stroke",  (is_particle) ? "black" : colorCode);
		circle.setAttribute("stroke-width", (is_particle) ? "1" : "0");
		circle.setAttribute("cx", cx);
		circle.setAttribute("cy", cy);
		circle.setAttribute("r", w/2);
		svg.appendChild(circle);
	}

	function drawLine(x1,y1,x2,y2)
	{
		var line = document.createElementNS(namespace, "line");
		line.setAttribute("stroke", colorCode);
		line.setAttribute("stroke-width", "2");
		line.setAttribute("x1", x1);
		line.setAttribute("y1", y1);
		line.setAttribute("x2", x2);
		line.setAttribute("y2", y2);
		svg.appendChild(line);
	}

	var pitchPatterns = 
	[
		/* 1 kana */[ [0,1], [1,0] ],
		/* 2 kana */[ [0,1,1], [1,0,0], [0,1,0] ],   
		/* 3 kana */[ [0,1,1,1], [1,0,0,0], [0,1,0,0], [0,1,1,0] ],
		/* 4 kana */[ [0,1,1,1,1], [1,0,0,0,0], [0,1,0,0,0], [0,1,1,0,0], [0,1,1,1,0] ],
		/* 5 kana */[ [0,1,1,1,1,1], [1,0,0,0,0,0], [0,1,0,0,0,0], [0,1,1,0,0,0], [0,1,1,1,0,0], [0,1,1,1,1,0] ],
		/* 6 kana */[ [0,1,1,1,1,1,1], [1,0,0,0,0,0,0], [0,1,0,0,0,0,0], [0,1,1,0,0,0,0], [0,1,1,1,0,0,0], [0,1,1,1,1,0,0], [0,1,1,1,1,1,0] ]
	];

	/* find pattern from table */
	var x = pitchNum;
	var y = kanaLength;
	var pattern = pitchPatterns[y][x];

	// get the points from pattern
	for (var i = 1; i <= kanaPlusParticleLength; i++)
	{
		calculatePoints(pattern[i-1], i/(kanaPlusParticleLength));
	}
	// draw lines between points
	for (var i = 0; i < points.length - 1; i++)
	{
		drawLine(points[i].x, points[i].y, points[i+1].x, points[i+1].y);
	}
	// draw circles at points
	for (var i = 0; i < points.length; i++)
	{
	  	drawPitchDot(points[i].x, points[i].y, i == points.length - 1);
	}

	pitchDiagram.appendChild(svg);
	kanaElem.appendChild(pitchDiagram);
}

function writeToPage(pitchNum, pitchNum2)
{
	getKanaInfo();

	var appendHtml = "";

	if (SHOW_PITCH_DESCRIPTION)
	{
		var appendHtml = "";
		var styles = "display:inline;margin-right: 0.5em;font-size: 11px;font-weight: bold;letter-spacing: 0;border-bottom: none;line-height: 1em;text-shadow: 0 1px 0 #fff;color: #999;";
		appendHtml = "<h2 style='"+styles+"'>PITCH PATTERN</h2>" + getPitchType(pitchNum) + " <a href=\"http://www.weblio.jp/content/" + vocab +"\" target=\"_blank\" >[" + pitchNum + "]</a>";
		if(pitchNum2 != null)
		{
			appendHtml += "<br/>or<br/>" + getPitchType(pitchNum2) + " <a href=\"http://www.weblio.jp/content/" + vocab +"\" target=\"_blank\" >[" + pitchNum2 + "]</a>";
		}	
	}
		
	if(pitchInfoElem != null)
	{
		pitchInfoElem.innerHTML = appendHtml;
		drawPitchDiagram(pitchNum);
	}
}
