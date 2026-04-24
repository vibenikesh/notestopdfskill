tell application "Notes"
	set output to ""
	set folderList to every folder
	repeat with aFolder in folderList
		set folderName to name of aFolder
		if folderName is not "Recently Deleted" then
			set noteList to every note in aFolder
			repeat with aNote in noteList
				set noteId to id of aNote
				set noteTitle to name of aNote
				set noteBody to body of aNote
				set noteModDate to modification date of aNote
				set noteCreDate to creation date of aNote
				-- tags: Notes app stores tags inside body as #tag, no native tag API in AppleScript
				-- We'll extract them in JS from the body
				set modDateStr to (noteModDate as string)
				set creDateStr to (noteCreDate as string)
				-- Use a safe delimiter
				set output to output & "|||FOLDER|||" & folderName & "|||ID|||" & noteId & "|||TITLE|||" & noteTitle & "|||MODDATE|||" & modDateStr & "|||CREDATE|||" & creDateStr & "|||BODY|||" & noteBody & "|||END|||"
			end repeat
		end if
	end repeat
	return output
end tell
